/**
 * Face capture + storage permissions (UPSERT-ONLY). LOCAL by default; pass --allow-remote to run
 * against another database (production), on purpose.
 *   faceCapture.link.create.*  faceCapture.read.*  faceCapture.download.*  faceCapture.register.*
 *   faceCapture.verify.*       faceCapture.delete.*  storage.read.*
 * Grants (added to the role's existing list; nothing removed):
 *   Attendance Manager, HR        -> link.create, read, register, verify
 *   Admin, Executives             -> everything above
 * A role that does not exist is reported and skipped. Same-named groups are not touched.
 * Also rewrites qa/_livefeatures.json so the featureMap generator sees the new keys.
 *   npx ts-node seedFaceCaptureFeatures.ts [--dry-run] [--allow-remote]
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedFaceCaptureFeatures] REFUSING — DATABASE_URL host "${host}" is not local. Pass --allow-remote to run it there on purpose.`);
  process.exit(2);
}
const DRY = process.argv.includes("--dry-run");

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  ["faceCapture.*", null, "Face capture"],
  ["faceCapture.link.*", "faceCapture.*", "Face capture links"],
  ["faceCapture.link.create.*", "faceCapture.link.*", "Create a face capture link"],
  ["faceCapture.read.*", "faceCapture.*", "View face capture status and photos"],
  ["faceCapture.download.*", "faceCapture.*", "Download face capture photos (ZIP)"],
  ["faceCapture.register.*", "faceCapture.*", "Register a face from a capture and test the match"],
  ["faceCapture.verify.*", "faceCapture.*", "Mark a face verified or needs redo"],
  ["faceCapture.delete.*", "faceCapture.*", "Delete face capture photos"],
  ["storage.*", null, "Storage"],
  ["storage.read.*", "storage.*", "View storage used per employee"],
];

const MANAGER = ["faceCapture.link.create.*", "faceCapture.read.*", "faceCapture.register.*", "faceCapture.verify.*"];
const EVERYTHING = [...MANAGER, "faceCapture.download.*", "faceCapture.delete.*", "storage.read.*"];
const GRANTS: Record<string, string[]> = {
  "Attendance Manager": MANAGER,
  HR: MANAGER,
  Admin: EVERYTHING,
  Executives: EVERYTHING,
};

async function main() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    if (DRY) { console.log(`[dry-run] feature ${name}`); continue; }
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[seedFaceCaptureFeatures] features ${DRY ? "to upsert" : "upserted"}: ${FEATURES.length}`);

  for (const [roleName, keys] of Object.entries(GRANTS)) {
    const role = await prisma.role.findFirst({ where: { name: roleName, isDeleted: null } as any, select: { id: true } });
    if (!role) { console.log(`[seedFaceCaptureFeatures] role "${roleName}" not found — skipped`); continue; }
    const fp: any = await prisma.featurePermission.findFirst({ where: { parentType: "Role", parentId: role.id, isDeleted: null } as any });
    const current: string[] = Array.isArray(fp?.permissions?.allowedFeatures) ? fp.permissions.allowedFeatures : [];
    const add = keys.filter((k) => !current.includes(k));
    if (!add.length) { console.log(`[seedFaceCaptureFeatures] ${roleName}: already has all ${keys.length}`); continue; }
    console.log(`[seedFaceCaptureFeatures] ${roleName}: ${DRY ? "would add" : "adding"} ${add.join(", ")}`);
    if (DRY) continue;
    const permissions = { ...(fp?.permissions || {}), allowedFeatures: [...current, ...add] };
    if (fp) await prisma.featurePermission.update({ where: { id: fp.id }, data: { permissions } as any });
    else await prisma.featurePermission.create({ data: { parentType: "Role", parentId: role.id, permissions, createdAt: new Date() } as any });
  }

  if (!DRY) {
    const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
    fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(all.map((f) => f.name).sort(), null, 2));
    console.log(`[seedFaceCaptureFeatures] qa/_livefeatures.json rewritten (${all.length} features)`);
  }
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[seedFaceCaptureFeatures] error", e); process.exit(1); });
