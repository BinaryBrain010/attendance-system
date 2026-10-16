/**
 * CRM Phase 1 seed (LOCAL ONLY):
 *   1. Registers the crm.* AppFeature tree (+ appModules.crm.*).
 *   2. Seeds the curated catalogue (categories, products, a retail+cost price each, a couple of
 *      variants, one starter bundle) from Docs/SalesCRM_Design.md §10.
 *   3. Maps sales agents AG001..AG008 to EXISTING Employee+User rows BY NAME (never creates users);
 *      prints a match/gap report. Gaps are left for the user to resolve.
 *   4. Rewrites qa/_livefeatures.json from the DB so the featureMap generator sees the new features.
 *
 *   npx ts-node crmSeed.ts
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

// ---- hard local guard (prod run is an explicit opt-in: --allow-remote, per PROD_DEPLOY_PLAN) ----
const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`[crmSeed] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote for the prod run per the deploy plan).`); process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
function leaves(root: string, parent: string, kinds: string[], labels: Record<string, string>): F[] {
  return kinds.map((k) => [`${root}.${k}.*`, parent, labels[k] || k] as F);
}

const CRUD = ["read", "create", "update", "delete", "restore"];
const CRUDL: Record<string, string> = { read: "View", create: "Create", update: "Edit", delete: "Delete", restore: "Restore" };

const FEATURES: F[] = [
  ["crm.*", null, "CRM"],
  ["appModules.crm.*", "appModules.*", "CRM (menu)"],

  ["crm.catalogue.*", "crm.*", "Catalogue"],
  ...leaves("crm.catalogue", "crm.catalogue.*", [...CRUD, "import", "export", "cost"],
    { ...CRUDL, import: "Import", export: "Export", cost: "View cost & margin" }),

  ["crm.agent.*", "crm.*", "Sales Agents"],
  ...leaves("crm.agent", "crm.agent.*", CRUD, CRUDL),

  ["crm.lead.*", "crm.*", "Leads"],
  ["crm.lead.read.*", "crm.lead.*", "View leads (all scopes)"],
  ["crm.lead.read.own.*", "crm.lead.read.*", "View own leads"],
  ["crm.lead.read.team.*", "crm.lead.read.*", "View team leads"],
  ["crm.lead.read.all.*", "crm.lead.read.*", "View all leads"],
  ...leaves("crm.lead", "crm.lead.*", ["create", "update", "delete", "restore", "transition", "assign", "import", "export", "timeline"],
    { ...CRUDL, transition: "Change stage", assign: "Assign agent", import: "Import", export: "Export", timeline: "View timeline" }),

  ["crm.quotation.*", "crm.*", "Quotations"],
  ["crm.quotation.read.*", "crm.quotation.*", "View quotations (all scopes)"],
  ["crm.quotation.read.own.*", "crm.quotation.read.*", "View own quotations"],
  ["crm.quotation.read.team.*", "crm.quotation.read.*", "View team quotations"],
  ["crm.quotation.read.all.*", "crm.quotation.read.*", "View all quotations"],
  ...leaves("crm.quotation", "crm.quotation.*", ["create", "update", "delete", "restore", "transition", "export"],
    { ...CRUDL, transition: "Change status", export: "Export" }),

  ["crm.order.*", "crm.*", "Sales Orders"],
  ["crm.order.read.*", "crm.order.*", "View orders (all scopes)"],
  ["crm.order.read.own.*", "crm.order.read.*", "View own orders"],
  ["crm.order.read.team.*", "crm.order.read.*", "View team orders"],
  ["crm.order.read.all.*", "crm.order.read.*", "View all orders"],
  ...leaves("crm.order", "crm.order.*", ["create", "update", "delete", "restore", "transition", "reattempt", "export"],
    { ...CRUDL, transition: "Change status", reattempt: "Reattempt delivery", export: "Export" }),

  ["crm.return.*", "crm.*", "Returns"],
  ["crm.return.read.*", "crm.return.*", "View returns (all scopes)"],
  ["crm.return.read.own.*", "crm.return.read.*", "View own returns"],
  ["crm.return.read.team.*", "crm.return.read.*", "View team returns"],
  ["crm.return.read.all.*", "crm.return.read.*", "View all returns"],
  ...leaves("crm.return", "crm.return.*", ["create", "update", "delete", "transition", "import", "export"],
    { ...CRUDL, transition: "Change status", import: "Import", export: "Export" }),

  ["crm.report.*", "crm.*", "Reports"],
  ["crm.report.read.*", "crm.report.*", "View reports"],
  ["crm.report.export.*", "crm.report.*", "Export reports"],
];

// ---- curated catalogue (Docs/SalesCRM_Design.md §10); prices are placeholder PKR ----
const CATEGORIES = ["Smart Locks", "Smart Switches & Panels", "Smart Plugs & Power", "Cameras & Security", "Lighting", "Appliances & Sensors", "Services & Bundles"];
type P = { cat: string; name: string; protocol?: string; price: number; cost: number };
const PRODUCTS: P[] = [
  { cat: "Smart Locks", name: "Super Smart Door Lock (Bluetooth)", protocol: "BLUETOOTH", price: 45000, cost: 32000 },
  { cat: "Smart Locks", name: "Smart Vision Door Lock", protocol: "WIFI", price: 52000, cost: 37000 },
  { cat: "Smart Locks", name: "Glass Door Lock with Camera", protocol: "WIFI", price: 68000, cost: 49000 },
  { cat: "Smart Locks", name: "Nova Door Lock (Matt)", protocol: "WIFI", price: 41000, cost: 29000 },
  { cat: "Smart Locks", name: "Classic Door Lock", protocol: "WIFI", price: 38000, cost: 27000 },
  { cat: "Smart Locks", name: "Vault Door Lock", protocol: "WIFI", price: 72000, cost: 52000 },
  { cat: "Smart Locks", name: "Armour Door Lock (Face)", protocol: "WIFI", price: 85000, cost: 61000 },
  { cat: "Smart Locks", name: "Travel Pad Lock", protocol: "BLUETOOTH", price: 6500, cost: 4200 },
  { cat: "Smart Locks", name: "Smart Padlock (New Model)", protocol: "BLUETOOTH", price: 7000, cost: 4500 },
  { cat: "Smart Switches & Panels", name: "Crystal Series Smart Switch 2 Gang", protocol: "WIFI", price: 9500, cost: 6500 },
  { cat: "Smart Switches & Panels", name: "Crystal Series Smart Switch 4 Gang", protocol: "WIFI", price: 12500, cost: 8500 },
  { cat: "Smart Switches & Panels", name: "Crystal Series Smart Switch 8 Gang", protocol: "WIFI", price: 18500, cost: 13000 },
  { cat: "Smart Switches & Panels", name: "4 Gang + 1 Fan Smart Switch", protocol: "WIFI", price: 14000, cost: 9800 },
  { cat: "Smart Switches & Panels", name: "Mini Super Smart Panel", protocol: "WIFI", price: 21000, cost: 15000 },
  { cat: "Smart Switches & Panels", name: "Zigbee Switch", protocol: "ZIGBEE", price: 11000, cost: 7500 },
  { cat: "Smart Switches & Panels", name: "Geyser Switch", protocol: "WIFI", price: 8500, cost: 5800 },
  { cat: "Smart Plugs & Power", name: "10A Smart Plug", protocol: "WIFI", price: 3500, cost: 2200 },
  { cat: "Smart Plugs & Power", name: "16A Smart Plug", protocol: "WIFI", price: 4500, cost: 2900 },
  { cat: "Smart Plugs & Power", name: "40A Breaker (with box)", protocol: "WIFI", price: 15000, cost: 10500 },
  { cat: "Smart Plugs & Power", name: "BT Gateway (3-in-1)", protocol: "BLUETOOTH", price: 9000, cost: 6000 },
  { cat: "Cameras & Security", name: "Smart Camera 5MP", protocol: "WIFI", price: 11500, cost: 8000 },
  { cat: "Cameras & Security", name: "Classic Camera", protocol: "WIFI", price: 8500, cost: 5800 },
  { cat: "Cameras & Security", name: "Robot Camera", protocol: "WIFI", price: 13500, cost: 9500 },
  { cat: "Cameras & Security", name: "AI Intercom & Security Kit", protocol: "WIFI", price: 42000, cost: 30000 },
  { cat: "Cameras & Security", name: "Motion Sensor (Stand-Alone)", protocol: "WIFI", price: 4800, cost: 3100 },
  { cat: "Cameras & Security", name: "Exit Door Bell Button", protocol: "WIRED", price: 1800, cost: 1100 },
  { cat: "Lighting", name: "LED Light Bars", protocol: "WIFI", price: 3200, cost: 2000 },
  { cat: "Lighting", name: "9W RGB Bulb", protocol: "WIFI", price: 2200, cost: 1300 },
  { cat: "Lighting", name: "12W Slim RGB", protocol: "WIFI", price: 2800, cost: 1700 },
  { cat: "Lighting", name: "6W Zigbee RGB Downlight", protocol: "ZIGBEE", price: 2600, cost: 1600 },
  { cat: "Lighting", name: "5V Dream LED Strip (USB)", protocol: "WIFI", price: 1900, cost: 1100 },
  { cat: "Lighting", name: "Kids Lamp", protocol: "WIFI", price: 2400, cost: 1500 },
  { cat: "Appliances & Sensors", name: "Air Purifier X600", protocol: "WIFI", price: 38000, cost: 27000 },
  { cat: "Appliances & Sensors", name: "Air Purifier X500", protocol: "WIFI", price: 31000, cost: 22000 },
  { cat: "Appliances & Sensors", name: "Humidity-Temperature Sensor (WiFi)", protocol: "WIFI", price: 3800, cost: 2400 },
  { cat: "Appliances & Sensors", name: "Pet Feeder", protocol: "WIFI", price: 14500, cost: 10000 },
  { cat: "Appliances & Sensors", name: "Universal Remote (IR)", protocol: "WIFI", price: 4200, cost: 2700 },
  { cat: "Services & Bundles", name: "Home Automation (Consultation)", price: 0, cost: 0 },
  { cat: "Services & Bundles", name: "Installation", price: 5000, cost: 2000 },
];

const AGENTS: { code: string; full: string }[] = [
  { code: "AG001", full: "Usama Liaqat" },
  { code: "AG002", full: "Ghulam Mustafa" },
  { code: "AG003", full: "Hur Ali" },
  { code: "AG004", full: "Sadaf Raza" },
  { code: "AG005", full: "Hafiz Mubashir" },
  { code: "AG006", full: "Usman Arshad" },
  { code: "AG007", full: "Waleed Bin Saeed" },
  { code: "AG008", full: "Areeba Farooq" },
];

const PREFIX: Record<string, string> = {
  "Smart Locks": "OKS-LOCK",
  "Smart Switches & Panels": "OKS-SWCH",
  "Smart Plugs & Power": "OKS-PLUG",
  "Cameras & Security": "OKS-CAM",
  "Lighting": "OKS-LGHT",
  "Appliances & Sensors": "OKS-APPL",
  "Services & Bundles": "OKS-SERV",
};
const catCounter: Record<string, number> = {};
function skuFor(cat: string): string {
  const prefix = PREFIX[cat] || "OKS-GEN";
  catCounter[cat] = (catCounter[cat] || 0) + 1;
  return `${prefix}-${String(catCounter[cat]).padStart(3, "0")}`;
}

async function seedFeatures() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[crmSeed] features upserted: ${FEATURES.length}`);
}

async function seedCatalogue() {
  // Clear prior seeded catalogue (OKS-* products) so re-running with new SKUs/prices does not
  // duplicate. Only touches seeded products; real Shopify-imported SKUs (e.g. S31870) are left alone.
  const starter = await prisma.bundle.findUnique({ where: { name: "Starter Home Automation Kit" }, select: { id: true } });
  if (starter) {
    await prisma.bundleItem.deleteMany({ where: { bundleId: starter.id } });
    await prisma.bundle.delete({ where: { id: starter.id } });
  }
  const old = await prisma.product.findMany({ where: { sku: { startsWith: "OKS-" } }, select: { id: true } });
  const oldIds = old.map((o) => o.id);
  if (oldIds.length) {
    await prisma.priceList.deleteMany({ where: { productId: { in: oldIds } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: oldIds } } });
    await prisma.productImage.deleteMany({ where: { productId: { in: oldIds } } });
    await prisma.product.deleteMany({ where: { id: { in: oldIds } } });
  }

  const catId: Record<string, string> = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = await prisma.category.upsert({
      where: { name: CATEGORIES[i] },
      update: { sortOrder: i, isDeleted: null },
      create: { name: CATEGORIES[i], sortOrder: i },
    });
    catId[CATEGORIES[i]] = c.id;
  }
  for (const p of PRODUCTS) {
    const sku = skuFor(p.cat);
    const prod = await prisma.product.create({
      data: { sku, name: p.name, categoryId: catId[p.cat], protocol: (p.protocol as any) ?? null, status: "ACTIVE" },
    });
    // Placeholder price row: NO invented numbers — price/cost null, pricePending=true until the real
    // Shopify export (or the client) provides them. Lead-sheet prices are reference only.
    await prisma.priceList.create({ data: { productId: prod.id, tier: "RETAIL", price: null, cost: null, pricePending: true } });
  }
  console.log(`[crmSeed] categories=${CATEGORIES.length} products=${PRODUCTS.length} (prices PENDING — not seeded)`);

  // one starter bundle
  const bundleProducts = await prisma.product.findMany({
    where: { name: { in: ["10A Smart Plug", "9W RGB Bulb", "Smart Camera 5MP"] }, isDeleted: null },
    select: { id: true },
  });
  if (bundleProducts.length) {
    await prisma.bundle.create({
      data: { name: "Starter Home Automation Kit", description: "Plug + bulb + camera starter kit", items: { create: bundleProducts.map((b) => ({ productId: b.id, quantity: 1 })) } },
    });
    console.log("[crmSeed] starter bundle created");
  }
}

// token helpers for fuzzy name/username matching
const toks = (s: string) => (s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const tokMatch = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && a.slice(0, 4) === b.slice(0, 4));
const score = (nameToks: string[], candToks: string[]) => nameToks.filter((nt) => candToks.some((ct) => tokMatch(nt, ct))).length;

/**
 * Candidate-based agent mapping. For each agent code we gather candidates from BOTH Employees
 * (name+surname) and Users (username local-part), score them by fuzzy token overlap, show them, and
 * auto-link ONLY on a single unambiguous strong match (>=2 name tokens matched). Ambiguous or
 * weak-only -> reported, not linked. Never creates users.
 */
async function seedAgents() {
  console.log("\n[crmSeed] --- Agent mapping (Employees + User usernames, fuzzy; no users created) ---");
  const unmatched: string[] = [];
  for (const a of AGENTS) {
    const nameToks = toks(a.full);
    const orName = nameToks.flatMap((t) => [{ name: { contains: t, mode: "insensitive" as const } }, { surname: { contains: t, mode: "insensitive" as const } }]);
    const orUser = nameToks.map((t) => ({ username: { contains: t, mode: "insensitive" as const } }));
    const [emps, users] = await Promise.all([
      prisma.employee.findMany({ where: { isDeleted: null, OR: orName }, select: { id: true, name: true, surname: true }, take: 50 }),
      prisma.user.findMany({ where: { isDeleted: null, OR: orUser }, select: { id: true, username: true, employeeId: true }, take: 50 }),
    ]);
    // candidate map keyed by employeeId (the human)
    const cand: Record<string, { empId: string | null; label: string; username?: string; userId?: string; score: number }> = {};
    for (const e of emps) {
      const sc = score(nameToks, toks(`${e.name} ${e.surname}`));
      if (sc < 1) continue;
      const key = e.id;
      cand[key] = { empId: e.id, label: `${e.name} ${e.surname}`, score: Math.max(sc, cand[key]?.score || 0) };
    }
    for (const u of users) {
      const sc = score(nameToks, toks(u.username.split("@")[0]));
      if (sc < 1) continue;
      const key = u.employeeId || `user:${u.id}`;
      const prev = cand[key];
      cand[key] = { empId: u.employeeId, label: prev?.label || u.username, username: u.username, userId: u.id, score: Math.max(sc, prev?.score || 0) };
    }
    const all = Object.values(cand).sort((x, y) => y.score - x.score);
    const strong = all.filter((c) => c.score >= 2);
    const show = all.slice(0, 4).map((c) => `${c.username || c.label}${c.empId ? "" : " (no emp)"} score${c.score}`).join("; ") || "none";
    console.log(`  ${a.code} "${a.full}" candidates: ${show}`);

    if (strong.length === 1 && strong[0].empId) {
      const empId = strong[0].empId;
      const user = strong[0].userId ? { id: strong[0].userId, username: strong[0].username! }
        : await prisma.user.findFirst({ where: { employeeId: empId, isDeleted: null }, select: { id: true, username: true } });
      await prisma.salesAgent.upsert({
        where: { agentCode: a.code },
        update: { employeeId: empId, userId: user?.id ?? null, isDeleted: null },
        create: { agentCode: a.code, employeeId: empId, userId: user?.id ?? null, scope: "OWN", company: "OKASHASMART" },
      });
      console.log(`     -> LINKED emp ${empId.slice(0, 8)} / user ${user ? user.username : "NONE — needs login"}`);
    } else if (strong.length > 1) {
      console.log(`     -> AMBIGUOUS (${strong.length} strong candidates) — not linked, resolve manually`);
      unmatched.push(`${a.code} (${a.full}) ambiguous`);
    } else {
      console.log(`     -> UNMATCHED (no strong candidate) — resolve manually`);
      unmatched.push(`${a.code} (${a.full})`);
    }
  }
  if (unmatched.length) console.log(`  [crmSeed] UNRESOLVED agents (user action): ${unmatched.join(", ")}`);
}

async function regenerateLiveFeatures() {
  const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
  const names = all.map((f) => f.name).sort();
  fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(names, null, 2));
  console.log(`\n[crmSeed] qa/_livefeatures.json rewritten (${names.length} features)`);
}

async function main() {
  await seedFeatures();
  await seedCatalogue();
  await seedAgents();
  await regenerateLiveFeatures();
  await prisma.$disconnect();
  console.log("\n[crmSeed] done.");
}
runAsSystem(() => main()).catch((e) => { console.error(e); process.exit(1); });
