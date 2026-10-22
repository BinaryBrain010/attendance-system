/**
 * Phase 3c DRY RUN (READ-ONLY — writes nothing). Lists the users that the auto-suspend rule WOULD
 * suspend when deployed: those whose linked employee is RESIGNED / FIRE (terminated) or soft-deleted,
 * and who are not already suspended. Safe to run against prod.
 *   npx ts-node dryRunAutoSuspend.ts
 */
import prisma from "./src/core/models/base.model";

async function main() {
  const emps = await prisma.employee.findMany({
    where: { OR: [{ status: { in: ["RESIGNED", "FIRE"] as any } }, { isDeleted: { not: null } }] },
    select: { id: true, name: true, surname: true, code: true, status: true, isDeleted: true },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  const users = emps.length
    ? await prisma.user.findMany({
        where: { employeeId: { in: emps.map((e) => e.id) }, isDeleted: null, suspendedAt: null },
        select: { id: true, username: true, employeeId: true },
      })
    : [];

  console.log(`\n=== Auto-suspend DRY RUN (nothing written) ===`);
  console.log(`Employees resigned/terminated/deleted: ${emps.length}`);
  console.log(`Users that WOULD be auto-suspended on deploy: ${users.length}\n`);
  for (const u of users) {
    const e = u.employeeId ? byId.get(u.employeeId) : null;
    const reason = e?.isDeleted ? "deleted" : `status ${e?.status}`;
    console.log(`  ${u.username.padEnd(32)}  ${e ? `${e.code || ""} ${e.name} ${e.surname || ""}`.trim() : "(no employee)"}  [${reason}]`);
  }
  console.log("");
  await prisma.$disconnect();
}
main().catch((e) => { console.error("[dryRunAutoSuspend] error", e?.message || e); process.exit(1); });
