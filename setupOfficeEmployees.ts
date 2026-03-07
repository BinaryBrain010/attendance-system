/**
 * setupOfficeEmployees.ts
 *
 * This script creates an "Office Employees" role and an "Office Employees" group,
 * assigns the group to the role, assigns all users linked to ACTIVE or REJOINED
 * employees to that group, and sets every user's password to 'employee009' except
 * for admin@panel.com.
 *
 * What it does:
 * 1. Creates a role named "Office Employees" (or reuses it if it already exists).
 * 2. Creates a group named "Office Employees" (or reuses it if it already exists).
 * 3. Links the group to the role (GroupRole) so the group has this role.
 * 4. Finds all users whose linked employee has status ACTIVE or REJOINED (and is not deleted).
 * 5. Assigns all those users to the "Office Employees" group (UserGroup).
 * 6. Sets the password of every such user to 'employee009', except for admin@panel.com.
 *
 * Usage:
 *   npx ts-node setupOfficeEmployees.ts
 *
 * Or add to package.json scripts:
 *   "setup-office-employees": "ts-node setupOfficeEmployees.ts"
 */

import "dotenv/config";
import prisma from "./src/core/models/base.model";
import roleModel from "./src/modules/rbac/role/models/role.model";
import groupModel from "./src/modules/rbac/group/models/group.model";
import userModel from "./src/modules/rbac/user/models/user.model";

const ROLE_NAME = "Office Employees";
const GROUP_NAME = "Office Employees";
const DEFAULT_PASSWORD = "employee009";
const ADMIN_USERNAME = "admin@panel.com";

async function main() {
  console.log("=== Setup Office Employees Role & Group ===\n");

  try {
    // 1. Find or create role "Office Employees"
    let role: { id: string; name: string } | null = await prisma.role.findFirst({
      where: { name: ROLE_NAME, isDeleted: null },
      select: { id: true, name: true },
    });
    if (!role) {
      const created = await roleModel.role.gpCreate({
        name: ROLE_NAME,
        users: [],
        groups: [],
      });
      const createdRole = Array.isArray(created) ? created[0] : created;
      if (!createdRole?.id) throw new Error("Failed to create role");
      role = { id: createdRole.id, name: createdRole.name };
      console.log(`Created role: ${role.name} (id: ${role.id})`);
    } else {
      console.log(`Using existing role: ${role.name} (id: ${role.id})`);
    }
    if (!role) throw new Error("Role is missing after setup");

    // 2. Find or create group "Office Employees" and assign it to the role
    let group: { id: string; name: string } | null = await prisma.group.findFirst({
      where: { name: GROUP_NAME, isDeleted: null },
      select: { id: true, name: true },
    });
    if (!group) {
      const created = await groupModel.group.gpCreate({
        name: GROUP_NAME,
        users: [],
        roles: [role.id],
      });
      const createdGroup = Array.isArray(created) ? created[0] : created;
      if (!createdGroup?.id) throw new Error("Failed to create group");
      group = { id: createdGroup.id, name: createdGroup.name };
      console.log(`Created group: ${group.name} (id: ${group.id}) and assigned to role`);
    } else {
      console.log(`Using existing group: ${group.name} (id: ${group.id})`);
      // Ensure group is linked to the role (GroupRole)
      const existingLink = await prisma.groupRole.findFirst({
        where: { groupId: group.id, roleId: role.id, isDeleted: null },
      });
      if (!existingLink) {
        await prisma.groupRole.create({
          data: {
            groupId: group.id,
            roleId: role.id,
            active: true,
          },
        });
        console.log(`Linked group to role (GroupRole).`);
      }
    }

    if (!role || !group) throw new Error("Role or group is missing after setup");

    // 3. Get all users linked to ACTIVE or REJOINED employees (non-deleted)
    const employeeUsers = await prisma.user.findMany({
      where: {
        isDeleted: null,
        employeeId: { not: null },
        employee: {
          isDeleted: null,
          status: { in: ["ACTIVE", "REJOINED"] },
        },
      },
      select: { id: true, username: true },
    });

    console.log(`\nFound ${employeeUsers.length} user(s) linked to ACTIVE/REJOINED employees.`);

    if (employeeUsers.length === 0) {
      console.log("No users to assign to the group. Updating group with empty users.");
    } else {
      employeeUsers.forEach((u, i) => console.log(`  ${i + 1}. ${u.username} (${u.id})`));
    }

    // 4. Assign all those users to the group (replace existing user-group assignments for this group)
    await groupModel.group.gpUpdate(group.id, {
      name: GROUP_NAME,
      users: employeeUsers.map((u) => u.id),
      roles: [role.id],
    });
    console.log(`\nAssigned ${employeeUsers.length} user(s) to group "${GROUP_NAME}".`);

    // 5. Set password to 'employee009' for all except admin@panel.com
    const toUpdate = employeeUsers.filter((u) => u.username !== ADMIN_USERNAME);
    console.log(`\nSetting password to '${DEFAULT_PASSWORD}' for ${toUpdate.length} user(s) (excluding ${ADMIN_USERNAME}).`);

    let updated = 0;
    let failed = 0;
    for (const user of toUpdate) {
      try {
        await userModel.user.changePassowrd(user.id, DEFAULT_PASSWORD);
        updated++;
        console.log(`  ✓ ${user.username}`);
      } catch (err: any) {
        failed++;
        console.error(`  ✗ ${user.username}: ${err?.message || err}`);
      }
    }

    console.log("\n=== Summary ===");
    console.log(`Role: ${ROLE_NAME} (id: ${role.id})`);
    console.log(`Group: ${GROUP_NAME} (id: ${group.id}), assigned to role`);
    console.log(`Users in group: ${employeeUsers.length}`);
    console.log(`Passwords set to '${DEFAULT_PASSWORD}': ${updated} (failed: ${failed})`);
    console.log(`Admin (${ADMIN_USERNAME}) left unchanged.`);
  } catch (error: any) {
    console.error("Script failed:", error?.message || error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log("\nDone. Database connection closed.");
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
