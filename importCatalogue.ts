/**
 * Catalogue replacement from data/OKASHA SMART ALL PRODUCTS.xlsx.
 *
 * DRY RUN by default (no writes). Pass --apply to write. Refuses a non-local DATABASE_URL unless
 * --allow-remote is also passed. Safe to re-run (upsert by SKU; images/prices are idempotent).
 *
 *   npx ts-node importCatalogue.ts                      # dry run, local
 *   npx ts-node importCatalogue.ts --apply              # write, local
 *   npx ts-node importCatalogue.ts --allow-remote       # dry run against prod (NO writes)
 *   npx ts-node importCatalogue.ts --apply --allow-remote   # write to prod
 *
 * Sheet layout: header row 4 (B=Sr No, C="Prodcut Display"/image, D=Product Name, E=Colour, F=SKU),
 * data from row 5. A SECTION HEADER row is a banner: col C is a plain string (the section title),
 * and the SKU cell is empty or repeats the title. Each product's category is the nearest section
 * header above it; products before the first header go to "Uncategorised". Embedded pictures are
 * anchored by row; a colour variant with no own picture inherits the one from the row above that
 * shares its product name.
 *
 * Behaviour:
 *  - ARCHIVE (soft delete: isDeleted=now, status=DISCONTINUED) every existing non-deleted product
 *    whose SKU is NOT in the sheet. Never hard delete — old quotations/orders keep their items.
 *  - UPSERT by SKU: name, colour (stored in specs.colour), category (created if missing), primary
 *    image (compressed + thumbnail, like employee photos). A product in the sheet that was archived
 *    before is un-archived.
 *  - Duplicate SKUs: import the FIRST row, list every later row with the same SKU.
 *  - A named row with no SKU: only the known "Smart AI Deadbolt Lock" (WIFI) gets a generated SKU
 *    (OK-DEADBOLT-WIFI) and is listed; any other no-SKU named row is reported and skipped.
 *  - The sheet has NO prices: price tiers are left empty and each product is marked price-missing
 *    (a pricePending RETAIL placeholder) so the quotation picker shows "Price not set" and blocks
 *    quoting at 0. An existing product that already has price rows is left untouched.
 */
import path from "path";
import ExcelJS from "exceljs";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";
import { compressImageDataUrl, makeThumbnailDataUrl } from "./src/core/utils/imageCompression";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`[importCatalogue] REFUSING — DATABASE_URL host "${host}" is not local. Re-run with --allow-remote for prod.`);
  process.exit(2);
}

const FILE_CANDIDATES = [
  path.join(__dirname, "data", "OKASHA SMART ALL PRODUCTS.xlsx"),
  path.join(__dirname, "data", "OKASHA_SMART_ALL_PRODUCTS.xlsx"),
];
const DEADBOLT_SKU = "OK-DEADBOLT-WIFI";
const UNCATEGORISED = "Uncategorised";

type Row = {
  excelRow: number;
  name: string;
  colour: string;
  sku: string;
  category: string;
  imageId?: number;      // resolved embedded-image id (direct or inherited), if any
  imageInherited?: boolean;
  generatedSku?: boolean;
};

const render = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("");
    if ("text" in v) return String((v as any).text);
    if ("result" in v) return String((v as any).result);
  }
  return "";
};
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  const file = FILE_CANDIDATES.find((f) => { try { return require("fs").existsSync(f); } catch { return false; } });
  if (!file) { console.error(`[importCatalogue] file not found. Looked for:\n  ${FILE_CANDIDATES.join("\n  ")}`); process.exit(2); }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];

  // ---- image anchors: 1-based row -> imageId (first image on a row wins) ----
  const imgByRow: Record<number, number> = {};
  for (const im of (ws as any).getImages() as any[]) {
    const row = Math.round(im.range?.tl?.nativeRow ?? 0) + 1;
    if (imgByRow[row] === undefined) imgByRow[row] = im.imageId;
  }

  // ---- parse rows ----
  const problems: string[] = [];
  const generated: string[] = [];
  const duplicates: string[] = [];
  const rows: Row[] = [];
  const seenSku = new Map<string, number>(); // sku -> excel row of first occurrence
  const categories = new Set<string>();
  let currentCategory = "";
  let lastImgIdForName: Record<string, number> = {};

  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cRaw = row.getCell(3).value;
    const cText = typeof cRaw === "string" ? cRaw.trim() : "";
    const name = render(row.getCell(4).value).trim();
    const colour = render(row.getCell(5).value).trim();
    let sku = render(row.getCell(6).value).trim();

    // Section header banner: plain-string title in C, SKU empty or repeating the title.
    if (cText && (sku === "" || norm(sku) === norm(cText))) {
      currentCategory = norm(cText);
      categories.add(currentCategory);
      continue;
    }
    // Fully empty row (trailing) — skip quietly.
    if (!name && !sku) continue;

    if (!sku) {
      if (/smart ai deadbolt lock/i.test(name)) {
        sku = DEADBOLT_SKU;
        generated.push(`row ${r}: "${name}"${colour ? ` (${colour})` : ""} had no SKU -> generated ${DEADBOLT_SKU}`);
      } else {
        problems.push(`row ${r}: "${name}" has no SKU -> SKIPPED`);
        continue;
      }
    }

    const cat = currentCategory || UNCATEGORISED;
    if (cat === UNCATEGORISED) categories.add(UNCATEGORISED);

    // Duplicate SKU: first wins; list the rest.
    if (seenSku.has(sku)) {
      duplicates.push(`SKU ${sku}: row ${r} "${name}"${colour ? ` (${colour})` : ""} is a duplicate of row ${seenSku.get(sku)} -> NOT imported`);
      continue;
    }
    seenSku.set(sku, r);

    // Image: direct anchor, else inherit from the previous same-name row that had one.
    const nameKey = norm(name).toLowerCase();
    let imageId = imgByRow[r];
    let inherited = false;
    if (imageId !== undefined) {
      lastImgIdForName[nameKey] = imageId;
    } else if (lastImgIdForName[nameKey] !== undefined) {
      imageId = lastImgIdForName[nameKey];
      inherited = true;
    }

    rows.push({ excelRow: r, name, colour, sku, category: cat, imageId, imageInherited: inherited, generatedSku: sku === DEADBOLT_SKU });
  }

  const keptSkus = new Set(rows.map((x) => x.sku));
  const withImage = rows.filter((x) => x.imageId !== undefined);
  const directImages = withImage.filter((x) => !x.imageInherited).length;
  const inheritedImages = withImage.filter((x) => x.imageInherited).length;
  const noImage = rows.filter((x) => x.imageId === undefined);

  // ---- existing catalogue (to split create/update and compute the archive set) ----
  const existing = await prisma.product.findMany({ where: { isDeleted: null }, select: { sku: true } });
  const existingSkus = new Set(existing.map((p) => p.sku));
  const toCreate = rows.filter((x) => !existingSkus.has(x.sku));
  const toUpdate = rows.filter((x) => existingSkus.has(x.sku));
  const toArchive = existing.filter((p) => !keptSkus.has(p.sku));

  // ---- report ----
  const catList = Array.from(categories);
  console.log("\n==================== CATALOGUE IMPORT " + (APPLY ? "(APPLY)" : "(DRY RUN)") + " ====================");
  console.log(`file:            ${file}`);
  console.log(`DB host:         ${host}${host && !["localhost","127.0.0.1","[::1]"].includes(host) ? "  (REMOTE)" : ""}`);
  console.log(`sheet rows read: ${ws.rowCount}  |  products parsed: ${rows.length}`);
  console.log("");
  console.log(`TO ARCHIVE (soft delete, not in sheet): ${toArchive.length}`);
  console.log(`TO CREATE (new SKU):                    ${toCreate.length}`);
  console.log(`TO UPDATE (existing SKU):               ${toUpdate.length}`);
  console.log("");
  console.log(`CATEGORIES (${catList.length}): ${catList.map((c) => `"${c}"`).join(", ")}`);
  console.log("");
  console.log(`IMAGES matched: ${withImage.length}/${rows.length}  (direct ${directImages}, inherited ${inheritedImages})  |  no image: ${noImage.length}`);
  console.log("");
  console.log("PROBLEMS:");
  console.log(`  duplicate SKUs (${duplicates.length}):`);
  duplicates.forEach((d) => console.log("    - " + d));
  console.log(`  generated SKUs (${generated.length}):`);
  generated.forEach((g) => console.log("    - " + g));
  const uncategorised = rows.filter((x) => x.category === UNCATEGORISED);
  console.log(`  products before the first section header -> "${UNCATEGORISED}" (${uncategorised.length}): rows ${uncategorised.map((x) => x.excelRow).join(", ") || "none"}`);
  console.log(`  named rows skipped for no SKU (${problems.length}):`);
  problems.forEach((p) => console.log("    - " + p));
  if (noImage.length) console.log(`  products with no image (${noImage.length}): ${noImage.map((x) => x.sku).join(", ")}`);
  console.log("");

  if (!APPLY) {
    console.log("DRY RUN — no changes written. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  // ---- APPLY ----
  console.log("APPLYING…");

  // categories
  const catId: Record<string, string> = {};
  for (const name of catList) {
    const c = await prisma.category.upsert({ where: { name }, update: { isActive: true, isDeleted: null }, create: { name } });
    catId[name] = c.id;
  }

  // compress each embedded image once (cache by imageId)
  const imgCache = new Map<number, { full: string; thumb: string | null }>();
  const getImage = async (imageId: number): Promise<{ full: string; thumb: string | null } | null> => {
    if (imgCache.has(imageId)) return imgCache.get(imageId)!;
    try {
      const media: any = (wb as any).getImage(imageId);
      if (!media?.buffer) return null;
      const ext = (media.extension || "png").replace(/[^a-z0-9]/gi, "") || "png";
      const dataUrl = `data:image/${ext};base64,${Buffer.from(media.buffer).toString("base64")}`;
      const full = await compressImageDataUrl(dataUrl);
      const thumb = (await makeThumbnailDataUrl(full)) || (await makeThumbnailDataUrl(dataUrl));
      const out = { full: typeof full === "string" ? full : dataUrl, thumb };
      imgCache.set(imageId, out);
      return out;
    } catch { return null; }
  };

  let created = 0, updated = 0, imagesSet = 0, pendingPrices = 0;
  for (const row of rows) {
    const existingProd = await prisma.product.findUnique({ where: { sku: row.sku }, select: { id: true, specs: true } });
    const specs = { ...((existingProd?.specs as any) || {}), colour: row.colour || null };
    let productId: string;
    if (existingProd) {
      await prisma.product.update({
        where: { id: existingProd.id },
        data: { name: row.name, categoryId: catId[row.category], specs, status: "ACTIVE", isDeleted: null },
      });
      productId = existingProd.id;
      updated++;
    } else {
      const p = await prisma.product.create({
        data: { sku: row.sku, name: row.name, categoryId: catId[row.category], specs, status: "ACTIVE" },
        select: { id: true },
      });
      productId = p.id;
      created++;
    }

    // primary image (upsert the single primary row)
    if (row.imageId !== undefined) {
      const img = await getImage(row.imageId);
      if (img) {
        const prim = await prisma.productImage.findFirst({ where: { productId, isPrimary: true, isDeleted: null }, select: { id: true } });
        if (prim) await prisma.productImage.update({ where: { id: prim.id }, data: { url: img.full, thumbUrl: img.thumb, sortOrder: 0 } });
        else await prisma.productImage.create({ data: { productId, url: img.full, thumbUrl: img.thumb, isPrimary: true, sortOrder: 0 } });
        imagesSet++;
      }
    }

    // price: mark missing only when the product has no price rows yet (don't clobber a real price)
    const priceCount = await prisma.priceList.count({ where: { productId, isDeleted: null } });
    if (priceCount === 0) {
      await prisma.priceList.create({ data: { productId, tier: "RETAIL", price: null, pricePending: true } });
      pendingPrices++;
    }
  }

  // archive everything not in the sheet (soft delete + DISCONTINUED). Never hard delete.
  const archived = await prisma.product.updateMany({
    where: { isDeleted: null, sku: { notIn: Array.from(keptSkus) } },
    data: { isDeleted: new Date(), status: "DISCONTINUED" },
  });

  console.log(`\nDONE. created=${created} updated=${updated} archived=${archived.count} imagesSet=${imagesSet} pricePendingAdded=${pendingPrices} categories=${catList.length}`);
  await prisma.$disconnect();
}

runAsSystem(() => main()).catch((e) => { console.error("[importCatalogue] error", e); process.exit(1); });
