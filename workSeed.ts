/**
 * Work module seed (LOCAL ONLY): registers the work.* AppFeature tree (+ appModules.work.*) and
 * rewrites qa/_livefeatures.json so the featureMap generator sees the new features.
 *   npx ts-node workSeed.ts
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[workSeed] REFUSING — DATABASE_URL host "${host}" is not local.`); process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const CRUDL: Record<string, string> = { read: "View", create: "Create", update: "Edit", delete: "Delete" };
function leaves(root: string, kinds: string[], labels: Record<string, string>): F[] {
  return kinds.map((k) => [`${root}.${k}.*`, `${root}.*`, labels[k] || k] as F);
}

const FEATURES: F[] = [
  ["work.*", null, "Work"],
  ["appModules.work.*", "appModules.*", "Work (menu)"],

  ["work.team.*", "work.*", "Teams"],
  ["work.team.read.*", "work.team.*", "View teams"],
  ["work.team.read.all.*", "work.team.read.*", "View all teams"],
  ...leaves("work.team", ["create", "update", "delete"], CRUDL),

  ["work.task.*", "work.*", "Tasks"],
  ["work.task.read.*", "work.task.*", "View tasks (all scopes)"],
  ["work.task.read.own.*", "work.task.read.*", "View own tasks"],
  ["work.task.read.team.*", "work.task.read.*", "View team tasks"],
  ["work.task.read.all.*", "work.task.read.*", "View all tasks"],
  ...leaves("work.task", ["create", "update", "delete", "assign", "transition", "comment"],
    { ...CRUDL, assign: "Assign", transition: "Change status", comment: "Comment" }),

  ["work.report.*", "work.*", "Daily reports"],
  ["work.report.read.*", "work.report.*", "View reports (all scopes)"],
  ["work.report.read.own.*", "work.report.read.*", "View own reports"],
  ["work.report.read.team.*", "work.report.read.*", "View team reports"],
  ["work.report.read.all.*", "work.report.read.*", "View all reports"],
  ...leaves("work.report", ["submit", "comment"], { submit: "Submit daily report", comment: "Comment on reports" }),
];

async function main() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[workSeed] features upserted: ${FEATURES.length}`);
  const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
  const names = all.map((f) => f.name).sort();
  fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(names, null, 2));
  console.log(`[workSeed] qa/_livefeatures.json rewritten (${names.length} features)`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("[workSeed] error", e); process.exit(1); });
