/**
 * Seed the self-service "Employee" role + "Employees" group (Part 3). UPSERT-ONLY — never deletes or
 * downgrades anything. The role grants ONLY what a self-service login needs:
 *   - login.admin.*  (so the account can sign in to the web app and reach the "Me" app)
 * everything else in the Me app (own profile, attendance, leaves, documents, slips, requests,
 * notifications, my visitors) is already self/token access on the backend, so no broad feature is
 * granted. Auto-created employee logins are added to the Employees group, which carries this role.
 *
 *   npx ts-node seedEmployeeRole.ts                 # local
 *   npx ts-node seedEmployeeRole.ts --allow-remote  # prod (server DB host resolves to localhost)
 */
import prisma from "./src/core/models/base.model";
import { ParentType } from "@prisma/client";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedEmployeeRole] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}

const ROLE_NAME = "Employee";
const GROUP_NAME = "Employees";
const ROLE_FEATURES = ["login.admin.*"]; // self-service login only; Me-app endpoints are self/token

async function main() {
  // 1) Role (upsert by unique name).
  let role = await prisma.role.findFirst({ where: { name: ROLE_NAME } });
  if (!role) { role = await prisma.role.create({ data: { name: ROLE_NAME, createdAt: new Date() } as any }); console.log(`created role "${ROLE_NAME}"`); }
  else console.log(`role "${ROLE_NAME}" exists`);

  // 2) Role feature permissions (merge — never remove existing features).
  const existingFp = await prisma.featurePermission.findFirst({ where: { parentType: ParentType.Role, parentId: role.id, isDeleted: null } });
  if (!existingFp) {
    await prisma.featurePermission.create({ data: { parentType: ParentType.Role, parentId: role.id, permissions: { allowedFeatures: ROLE_FEATURES }, createdAt: new Date() } as any });
    console.log(`granted ${ROLE_FEATURES.join(", ")}`);
  } else {
    const cur: string[] = ((existingFp.permissions as any)?.allowedFeatures) || [];
    const merged = Array.from(new Set([...cur, ...ROLE_FEATURES]));
    if (merged.length !== cur.length) {
      await prisma.featurePermission.update({ where: { id: existingFp.id }, data: { permissions: { allowedFeatures: merged }, updatedAt: new Date() } as any });
      console.log(`merged features -> ${merged.join(", ")}`);
    } else console.log(`role features already include ${ROLE_FEATURES.join(", ")}`);
  }

  // 3) Group (upsert by unique name).
  let group = await prisma.group.findFirst({ where: { name: GROUP_NAME } });
  if (!group) { group = await prisma.group.create({ data: { name: GROUP_NAME, createdAt: new Date() } as any }); console.log(`created group "${GROUP_NAME}"`); }
  else console.log(`group "${GROUP_NAME}" exists`);

  // 4) Link group -> role (GroupRole, idempotent).
  const gr = await prisma.groupRole.findFirst({ where: { groupId: group.id, roleId: role.id, isDeleted: null } });
  if (!gr) { await prisma.groupRole.create({ data: { groupId: group.id, roleId: role.id, active: true, createdAt: new Date() } as any }); console.log(`linked group "${GROUP_NAME}" -> role "${ROLE_NAME}"`); }
  else console.log(`group already linked to role`);

  console.log(`\n[seedEmployeeRole] done. role=${role.id} group=${group.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
