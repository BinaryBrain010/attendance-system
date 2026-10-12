/**
 * Seed/refresh CRM + ops roles from `roleRecipes.ts` (LOCAL only by default). Idempotent: upserts the
 * Role row by name and replaces its FeaturePermission (parentType "Role") with the recipe's features.
 * Users are mapped to roles separately (UserRole) — this script only defines the roles.
 *
 *   npx ts-node seedRoles.ts                 # all recipes
 *   npx ts-node seedRoles.ts "Order Ops"     # one role
 *
 * On prod this is additive and safe (creates/updates roles only); run it as part of PROD_DEPLOY_PLAN.
 */
import prisma from "./src/core/models/base.model";
import { ROLE_RECIPES } from "./roleRecipes";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
const ALLOW_REMOTE = process.argv.includes("--allow-remote"); // explicit opt-in for the prod run
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`refusing: DATABASE_URL host "${host}" is not local (pass --allow-remote to run on prod per the deploy plan)`);
  process.exit(2);
}

async function upsertRole(name: string, features: string[]) {
  let role = await prisma.role.findUnique({ where: { name } });
  if (!role) role = await prisma.role.create({ data: { name, createdAt: new Date() } });
  // replace the role's feature permission
  await prisma.featurePermission.deleteMany({ where: { parentType: "Role", parentId: role.id } });
  await prisma.featurePermission.create({
    data: { parentType: "Role", parentId: role.id, permissions: { allowedFeatures: features } as any, createdAt: new Date() },
  });
  return role;
}

async function main() {
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const names = only ? [only] : Object.keys(ROLE_RECIPES);
  for (const name of names) {
    const recipe = ROLE_RECIPES[name];
    if (!recipe) { console.error(`unknown role recipe: "${name}". Known: ${Object.keys(ROLE_RECIPES).join(", ")}`); process.exit(1); }
    const role = await upsertRole(name, recipe.features);
    console.log(`✓ ${name}  (role ${role.id})  — ${recipe.features.length} features`);
  }
  console.log(`\nDone. Map users to roles via UserRole (admin UI or the deploy plan's mapping table).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
