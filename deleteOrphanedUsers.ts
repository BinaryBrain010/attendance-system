import prisma from "./src/core/models/base.model";
import userModel from "./src/modules/rbac/user/models/user.model";

/**
 * Script to delete all users that are not linked to any employee
 * 
 * This script will:
 * 1. Find all users where employeeId is null (not linked to any employee)
 * 2. Also find users where employeeId references a non-existent employee (orphaned references)
 * 3. Soft-delete these users using the gpSoftDelete method
 * 
 * Usage:
 *   npx ts-node deleteOrphanedUsers.ts
 * 
 * Or add to package.json scripts:
 *   "deleteOrphanedUsers": "ts-node deleteOrphanedUsers.ts"
 */

// Admin user ID - should not be deleted
const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

class DeleteOrphanedUsers {
  async execute() {
    try {
      console.log("Starting orphaned users cleanup...\n");

      // Step 1: Find users with null employeeId (not linked to any employee)
      const usersWithNullEmployeeId = await prisma.user.findMany({
        where: {
          employeeId: null,
          isDeleted: null, // Only find non-deleted users
          id: {
            not: ADMIN_USER_ID, // Exclude admin user
          },
        },
        select: {
          id: true,
          username: true,
          employeeId: true,
          createdAt: true,
        },
      });

      console.log(`Found ${usersWithNullEmployeeId.length} users with null employeeId:`);
      if (usersWithNullEmployeeId.length > 0) {
        usersWithNullEmployeeId.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.username} (ID: ${user.id}, Created: ${user.createdAt})`);
        });
      } else {
        console.log("  None found.");
      }

      // Step 2: Find users with orphaned employeeId references (employeeId exists but employee doesn't)
      const allUsersWithEmployeeId = await prisma.user.findMany({
        where: {
          employeeId: {
            not: null,
          },
          isDeleted: null,
          id: {
            not: ADMIN_USER_ID,
          },
        },
        select: {
          id: true,
          username: true,
          employeeId: true,
          createdAt: true,
        },
      });

      console.log(`\nChecking ${allUsersWithEmployeeId.length} users with employeeId for orphaned references...`);

      const orphanedUsers: typeof allUsersWithEmployeeId = [];
      for (const user of allUsersWithEmployeeId) {
        if (user.employeeId) {
          const employee = await prisma.employee.findUnique({
            where: {
              id: user.employeeId,
            },
            select: {
              id: true,
              isDeleted: true,
            },
          });

          // Consider employee deleted or non-existent as orphaned
          if (!employee || employee.isDeleted !== null) {
            orphanedUsers.push(user);
            console.log(`  Found orphaned user: ${user.username} (User ID: ${user.id}, Employee ID: ${user.employeeId})`);
          }
        }
      }

      // Combine both lists
      const usersToDelete = [...usersWithNullEmployeeId, ...orphanedUsers];
      const totalUsersToDelete = usersToDelete.length;

      console.log(`\n=== Summary ===`);
      console.log(`Users with null employeeId: ${usersWithNullEmployeeId.length}`);
      console.log(`Users with orphaned employeeId references: ${orphanedUsers.length}`);
      console.log(`Total users to delete: ${totalUsersToDelete}`);

      if (totalUsersToDelete === 0) {
        console.log("\nNo orphaned users found. Nothing to delete.");
        await prisma.$disconnect();
        return;
      }

      // Step 3: Delete the orphaned users
      console.log(`\nDeleting ${totalUsersToDelete} orphaned user(s)...\n`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const user of usersToDelete) {
        try {
          await userModel.user.gpSoftDelete(user.id);
          deletedCount++;
          console.log(`✓ Deleted user: ${user.username} (ID: ${user.id})`);
        } catch (error: any) {
          errorCount++;
          console.error(`✗ Error deleting user ${user.username} (ID: ${user.id}):`, error.message);
        }
      }

      console.log(`\n=== Deletion Complete ===`);
      console.log(`Successfully deleted: ${deletedCount} user(s)`);
      console.log(`Errors: ${errorCount} user(s)`);
      console.log(`Total processed: ${totalUsersToDelete} user(s)`);

      await prisma.$disconnect();
      console.log("\nDatabase connection closed.");
    } catch (error: any) {
      console.error("Error during orphaned users cleanup:", error);
      await prisma.$disconnect();
      throw error;
    }
  }
}

// Run the script
const script = new DeleteOrphanedUsers();
script.execute()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed with error:", error);
    process.exit(1);
  });