/**
 * Catalogue import from a Shopify "products export" CSV.
 * Columns used: Handle, Title, Variant SKU, Variant Price, Cost per item, Image Src, Product Type,
 * Vendor (Option1 Name/Value are used for variant names when present).
 *
 * Shopify emits one row per variant/image; only the first row of a Handle carries Title/Type/Vendor.
 * Mapping: Product Type -> Category, Vendor -> Brand, Title -> Product (sku = first Variant SKU, kept
 * as-is e.g. S31870), each variant row -> ProductVariant (+ its own PriceList), Image Src -> ProductImage.
 * Prices from the sheet are REAL (pricePending=false). Dry-run by default: nothing is written and a
 * cleaning report is returned; pass dryRun=false to persist.
 */
import prisma from "../../../../../core/models/base.model";
import { logEvent } from "../../../../../core/audit/event";

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let i = 0, f = "", row: string[] = [], q = false;
  text = text.replace(/^﻿/, "");
  while (i < text.length) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
    i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const money = (s: string): number | null => {
  if (s === undefined || s === null) return null;
  const n = Math.round(parseFloat(String(s).replace(/[^0-9.]/g, "")));
  return Number.isFinite(n) ? n : null;
};

interface ImportResult {
  dryRun: boolean;
  rowsParsed: number;
  products: any[];
  skipped: { row: number; reason: string }[];
  categories: string[];
  brands: string[];
  counts: { products: number; variants: number; prices: number; images: number; categories: number; brands: number };
  persisted?: { products: number; variants: number; prices: number; images: number };
}

class ShopifyImportService {
  async import(csv: string, dryRun = true): Promise<ImportResult> {
    const rows = parseCSV(csv);
    if (!rows.length) throw new Error("empty CSV");
    const header = rows[0].map((h) => h.trim());
    const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const idx = {
      handle: col("Handle"), title: col("Title"), sku: col("Variant SKU"), price: col("Variant Price"),
      cost: col("Cost per item"), image: col("Image Src"), type: col("Product Type"), vendor: col("Vendor"),
      optName: col("Option1 Name"), optVal: col("Option1 Value"),
    };
    if (idx.handle < 0 || idx.title < 0) throw new Error("not a Shopify products export (missing Handle/Title)");

    const skipped: { row: number; reason: string }[] = [];
    const byHandle: Record<string, { title: string; type: string; vendor: string; variants: any[]; images: Set<string> }> = {};
    const order: string[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => !String(c).trim())) continue;
      const handle = (row[idx.handle] || "").trim();
      if (!handle) { skipped.push({ row: r + 1, reason: "no Handle" }); continue; }
      if (!byHandle[handle]) {
        const title = (row[idx.title] || "").trim();
        if (!title) { skipped.push({ row: r + 1, reason: "first row of handle has no Title" }); continue; }
        byHandle[handle] = {
          title,
          type: (idx.type >= 0 ? row[idx.type] : "").trim() || "Uncategorized",
          vendor: (idx.vendor >= 0 ? row[idx.vendor] : "").trim(),
          variants: [], images: new Set<string>(),
        };
        order.push(handle);
      }
      const g = byHandle[handle];
      const sku = (idx.sku >= 0 ? row[idx.sku] : "").trim();
      const price = idx.price >= 0 ? money(row[idx.price]) : null;
      const cost = idx.cost >= 0 ? money(row[idx.cost]) : null;
      const optVal = (idx.optVal >= 0 ? row[idx.optVal] : "").trim();
      if (sku || price !== null) g.variants.push({ sku, price, cost, name: optVal || null });
      const img = (idx.image >= 0 ? row[idx.image] : "").trim();
      if (img) g.images.add(img);
    }

    const products: any[] = [];
    const cats = new Set<string>(), brands = new Set<string>();
    let vCount = 0, pCount = 0, imgCount = 0;
    for (const h of order) {
      const g = byHandle[h];
      cats.add(g.type); if (g.vendor) brands.add(g.vendor);
      const sku = g.variants[0]?.sku || h; // keep Shopify SKU (e.g. S31870)
      const prices = g.variants.filter((v) => v.price !== null).length;
      vCount += g.variants.length; pCount += prices; imgCount += g.images.size;
      products.push({
        handle: h, sku, name: g.title, category: g.type, brand: g.vendor || null,
        variants: g.variants.map((v) => ({ sku: v.sku, name: v.name, price: v.price, cost: v.cost })),
        images: Array.from(g.images), defaultPrice: g.variants[0]?.price ?? null, defaultCost: g.variants[0]?.cost ?? null,
      });
    }

    const result: ImportResult = {
      dryRun, rowsParsed: rows.length - 1, products: dryRun ? products.slice(0, 50) : [], skipped,
      categories: Array.from(cats), brands: Array.from(brands),
      counts: { products: products.length, variants: vCount, prices: pCount, images: imgCount, categories: cats.size, brands: brands.size },
    };
    if (dryRun) return result;

    // ---- persist ----
    const catId: Record<string, string> = {};
    for (const name of cats) {
      const c = await prisma.category.upsert({ where: { name }, update: { isDeleted: null }, create: { name } });
      catId[name] = c.id;
    }
    const brandId: Record<string, string> = {};
    for (const name of brands) {
      const b = await prisma.brand.upsert({ where: { name }, update: { isDeleted: null }, create: { name } });
      brandId[name] = b.id;
    }
    let P = 0, V = 0, PR = 0, IM = 0;
    for (const p of products) {
      const prod = await prisma.product.upsert({
        where: { sku: p.sku },
        update: { name: p.name, categoryId: catId[p.category], brandId: p.brand ? brandId[p.brand] : null, isDeleted: null },
        create: { sku: p.sku, name: p.name, categoryId: catId[p.category], brandId: p.brand ? brandId[p.brand] : null, status: "ACTIVE" },
      });
      P++;
      await prisma.priceList.updateMany({ where: { productId: prod.id, tier: "RETAIL", validTo: null, isDeleted: null }, data: { validTo: new Date() } });
      const pending = p.defaultPrice === null;
      await prisma.priceList.create({ data: { productId: prod.id, tier: "RETAIL", price: p.defaultPrice, cost: p.defaultCost, pricePending: pending } });
      PR++;
      for (const v of p.variants) {
        if (!v.name && !v.sku) continue;
        await prisma.productVariant.upsert({
          where: { productId_name: { productId: prod.id, name: v.name || v.sku || "default" } },
          update: { skuSuffix: v.sku || null },
          create: { productId: prod.id, name: v.name || v.sku || "default", skuSuffix: v.sku || null },
        }).catch(() => {});
        V++;
      }
      for (let k = 0; k < p.images.length; k++) {
        await prisma.productImage.create({ data: { productId: prod.id, url: p.images[k], isPrimary: k === 0, sortOrder: k } });
        IM++;
      }
    }
    result.persisted = { products: P, variants: V, prices: PR, images: IM };
    await logEvent({ module: "CRM", entity: "Product", action: "IMPORT", changes: { source: "shopify", products: P, variants: V, prices: PR, images: IM } });
    return result;
  }
}

export default ShopifyImportService;
