/**
 * Create the "Online Orders" sales agent and assign the online-store orders/returns to it (LOCAL by
 * default). Idempotent: upserts a placeholder Employee + SalesAgent (agentCode AG-ONLINE, userId null
 * until the real operator is confirmed), then assigns:
 *   - every RETURNS_IMPORT order, and every unassigned ONLINE_STORE order, to the agent (leadId kept)
 *   - every return on those orders to the agent
 *
 *   npx ts-node seedOnlineOrdersAgent.ts
 *
 * NOTE: SalesAgent.employeeId is required, so a clearly-labelled virtual Employee is created. When the
 * real person is confirmed, point SalesAgent.userId (login) — and, if wanted, employeeId — at them and
 * remove the placeholder. Run with --allow-remote only as part of PROD_DEPLOY_PLAN.
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`refusing: DATABASE_URL host "${host}" is not local (pass --allow-remote for the prod run)`);
  process.exit(2);
}

const AGENT_CODE = "AG-ONLINE";
const EMP_CODE = "SYS-ONLINE-ORDERS";

async function ensureAgent(): Promise<string> {
  const existing = await prisma.salesAgent.findUnique({ where: { agentCode: AGENT_CODE } });
  if (existing) return existing.id;
  let emp = await prisma.employee.findUnique({ where: { code: EMP_CODE } });
  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        name: "Online", surname: "Orders", address: "—", dob: new Date("2000-01-01"), joiningDate: new Date(),
        bloodGroup: "—", contactNo: "—", designation: "Online Orders (virtual sales agent)", department: "Sales",
        martialStatus: "—", company: "OKASHASMART", code: EMP_CODE, status: "ACTIVE",
        notes: "Virtual/system sales agent bucket for online-store orders & RTOs. Link SalesAgent.userId to the real operator when confirmed, then this placeholder can be retired.",
      },
    });
  }
  const agent = await prisma.salesAgent.create({
    data: { agentCode: AGENT_CODE, employeeId: emp.id, userId: null, scope: "OWN", company: "OKASHASMART", monthlyTarget: null, legacyId: "SYS-ONLINE-ORDERS" },
  });
  return agent.id;
}

async function main() {
  const agentId = await ensureAgent();
  const ownedBefore = {
    orders: await prisma.salesOrder.count({ where: { agentId } }),
    returns: await prisma.salesReturn.count({ where: { agentId } }),
  };

  // 1) assign RETURNS_IMPORT orders + unassigned online-store orders (keep leadId as-is)
  const ordRes = await prisma.salesOrder.updateMany({
    where: { isDeleted: null, OR: [{ sourceFile: "RETURNS_IMPORT" }, { channel: "ONLINE_STORE", agentId: null }] },
    data: { agentId },
  });

  // 2) assign every return whose order now belongs to this agent
  const ownedOrders = await prisma.salesOrder.findMany({ where: { agentId }, select: { id: true } });
  const orderIds = ownedOrders.map((o) => o.id);
  const retRes = await prisma.salesReturn.updateMany({ where: { isDeleted: null, orderId: { in: orderIds } }, data: { agentId } });

  const ownedAfter = {
    orders: await prisma.salesOrder.count({ where: { agentId } }),
    returns: await prisma.salesReturn.count({ where: { agentId } }),
  };

  console.log("=== Online Orders agent ready ===");
  console.log("agentId:", agentId, "code:", AGENT_CODE, "(userId pending the confirmed person)");
  console.log("orders assigned this run:", ordRes.count, "| returns assigned this run:", retRes.count);
  console.log("owned orders  before/after:", ownedBefore.orders, "->", ownedAfter.orders);
  console.log("owned returns before/after:", ownedBefore.returns, "->", ownedAfter.returns);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error(e); process.exit(1); });
