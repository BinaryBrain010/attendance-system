/**
 * Sync SalesAgent.userId from the agent's employee's linked login: for every agent whose userId is
 * null but whose employee has a linked User, set the agent's userId to that user. This is the one-off
 * reconciliation for agents created/imported before linkEmployee kept the two in sync.
 *
 * DRY RUN BY DEFAULT — prints each change and writes nothing. Pass --apply to perform the updates.
 *
 *   npx ts-node qa/syncAgentLogins.ts                 # dry run (list only)
 *   npx ts-node qa/syncAgentLogins.ts --apply         # perform the sync
 *   (prod DB host resolves to "localhost", so no --allow-remote is needed; it is accepted anyway)
 *
 * Skips an agent whose employee has no login, and (SalesAgent.userId is unique) an agent whose would-be
 * login is already tied to a different agent — those are reported as conflicts to resolve by hand.
 */
import "dotenv/config"; // load ~/server/.env (DATABASE_URL) when run as a standalone script
import prisma from "../src/core/models/base.model";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`[syncAgentLogins] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}

async function main() {
  console.log(`[syncAgentLogins] mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}  db-host: ${host}\n`);

  const agents = await prisma.salesAgent.findMany({
    where: { userId: null, isDeleted: null },
    select: { id: true, agentCode: true, employeeId: true, employee: { select: { name: true, surname: true } } },
    orderBy: { agentCode: "asc" },
  });

  let willSet = 0, noLogin = 0, conflicts = 0, done = 0;
  for (const a of agents) {
    const emp = a.employee ? `${a.employee.name} ${a.employee.surname ?? ""}`.trim() : a.employeeId.slice(0, 8);
    const user = await prisma.user.findFirst({ where: { employeeId: a.employeeId, isDeleted: null }, select: { id: true, username: true } });
    if (!user) { noLogin++; continue; }
    // userId is unique: skip if that login is already attached to a different agent.
    const clash = await prisma.salesAgent.findFirst({ where: { userId: user.id, id: { not: a.id }, isDeleted: null }, select: { agentCode: true } });
    if (clash) {
      conflicts++;
      console.log(`  CONFLICT  ${a.agentCode} (${emp}) -> login "${user.username}" is already on agent ${clash.agentCode}; skip`);
      continue;
    }
    willSet++;
    console.log(`  ${APPLY ? "SET " : "would set"}  ${a.agentCode} (${emp})  userId -> "${user.username}"`);
    if (APPLY) { await prisma.salesAgent.update({ where: { id: a.id }, data: { userId: user.id } }); done++; }
  }

  console.log("");
  console.log(`[syncAgentLogins] agents with null userId: ${agents.length}`);
  console.log(`  ${APPLY ? "set" : "would set"}: ${APPLY ? done : willSet}   no login on employee: ${noLogin}   conflicts (manual): ${conflicts}`);
  console.log(APPLY ? "[syncAgentLogins] done (APPLIED)." : "[syncAgentLogins] DRY RUN — nothing written. Re-run with --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("[syncAgentLogins] error", e); process.exit(1); });
