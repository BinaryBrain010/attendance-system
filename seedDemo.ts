/**
 * Demo seed — populates gatepass_demo ONLY with realistic, presentable data for a client demo.
 * No QA_ prefixes. Safe to re-run (removes its own demo markers first). NEVER touches the dev DB:
 * it refuses to run unless DATABASE_URL points at gatepass_demo.
 *
 *   DATABASE_URL="postgresql://.../gatepass_demo?..." npx ts-node seedDemo.ts
 *
 * Demo markers (for idempotent cleanup): users "*@demo.pk", employees code "DEMO-*", SalesAgents
 * agentCode "DMO-*", leads sourceFile "DEMO", quotations "QT-2026-*", orders "SO-2026-*",
 * returns "RT-2026-*", teams named Sales/Operations/HR (demo DB has none real).
 */
import prisma from "./src/core/models/base.model";
import { runWithContext } from "./src/core/context/requestContext";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { normalizePhone } from "./src/modules/CRM/shared/phone";

const DB = process.env.DATABASE_URL || "";
if (!/\/gatepass_demo(\?|$)/.test(DB)) {
  console.error(`[seedDemo] REFUSE: DATABASE_URL must point at gatepass_demo (got "${DB.replace(/:[^:@/]+@/, ":***@")}").`);
  process.exit(2);
}

const PASSWORD = "demo1234";
const now = new Date();
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

const EMP_BASE = {
  address: "Gulberg III, Lahore", dob: new Date("1990-05-10"), joiningDate: new Date("2022-01-15"),
  bloodGroup: "O+", martialStatus: "SINGLE", status: "ACTIVE" as const, company: "OKASHASMART" as const,
};

// Realistic people: [key, name, surname, designation, department, role, username]
const PEOPLE: { key: string; name: string; surname: string; desig: string; dept: string; role: string; user: string; contact: string }[] = [
  { key: "admin", name: "Aisha", surname: "Khan", desig: "System Administrator", dept: "IT", role: "Admin", user: "admin@demo.pk", contact: "03001000001" },
  { key: "manager", name: "Bilal", surname: "Ahmed", desig: "Sales Manager", dept: "Sales", role: "Sales Manager", user: "manager@demo.pk", contact: "03001000002" },
  { key: "agent", name: "Fatima", surname: "Noor", desig: "Sales Executive", dept: "Sales", role: "Sales Agent", user: "agent@demo.pk", contact: "03001000003" },
  { key: "orderops", name: "Hamza", surname: "Tariq", desig: "Order Operations", dept: "Operations", role: "Order Ops", user: "orders@demo.pk", contact: "03001000004" },
  { key: "frontdesk", name: "Sana", surname: "Malik", desig: "Receptionist", dept: "Front Office", role: "Frontdesk", user: "frontdesk@demo.pk", contact: "03001000005" },
  { key: "hr", name: "Imran", surname: "Shah", desig: "HR Officer", dept: "Human Resources", role: "HR", user: "hr@demo.pk", contact: "03001000006" },
  { key: "lead", name: "Zara", surname: "Sheikh", desig: "Operations Lead", dept: "Operations", role: "Team Lead", user: "lead@demo.pk", contact: "03001000007" },
  { key: "employee", name: "Omar", surname: "Farooq", desig: "Operations Associate", dept: "Operations", role: "Employee", user: "employee@demo.pk", contact: "03001000008" },
];
// Extra team members (no login) so teams/daily-reports have body.
const EXTRA_EMP = [
  { key: "e_ali", name: "Ali", surname: "Raza", desig: "Sales Executive", dept: "Sales", contact: "03001000011" },
  { key: "e_sara", name: "Sara", surname: "Iqbal", desig: "Operations Associate", dept: "Operations", contact: "03001000012" },
  { key: "e_usman", name: "Usman", surname: "Javed", desig: "Operations Associate", dept: "Operations", contact: "03001000013" },
  { key: "e_hina", name: "Hina", surname: "Aslam", desig: "HR Assistant", dept: "Human Resources", contact: "03001000014" },
];

async function cleanupPriorDemo() {
  console.log("[seedDemo] removing any prior demo data...");
  // children first
  await prisma.quotationItem.deleteMany({ where: { quotation: { quotationNo: { startsWith: "QT-2026-" } } } }).catch(() => {});
  await prisma.quotation.deleteMany({ where: { quotationNo: { startsWith: "QT-2026-" } } }).catch(() => {});
  await prisma.returnItem.deleteMany({ where: { return: { returnNo: { startsWith: "RT-2026-" } } } }).catch(() => {});
  await prisma.salesReturn.deleteMany({ where: { returnNo: { startsWith: "RT-2026-" } } }).catch(() => {});
  await prisma.salesOrderItem.deleteMany({ where: { order: { orderNo: { startsWith: "SO-2026-" } } } }).catch(() => {});
  await prisma.salesOrder.deleteMany({ where: { orderNo: { startsWith: "SO-2026-" } } }).catch(() => {});
  const demoLeadIds = (await prisma.lead.findMany({ where: { sourceFile: "DEMO" }, select: { id: true } })).map((l) => l.id);
  if (demoLeadIds.length) await prisma.leadActivity.deleteMany({ where: { leadId: { in: demoLeadIds } } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { sourceFile: "DEMO" } }).catch(() => {});
  // work
  const teams = await prisma.team.findMany({ where: { name: { in: ["Sales", "Operations", "HR"] } }, select: { id: true } });
  const tids = teams.map((t) => t.id);
  if (tids.length) {
    const tasks = await prisma.task.findMany({ where: { teamId: { in: tids } }, select: { id: true } });
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length) {
      await prisma.taskChecklistItem.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.taskAssignee.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.taskWatcher.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    }
    await prisma.teamMember.deleteMany({ where: { teamId: { in: tids } } });
    await prisma.team.deleteMany({ where: { id: { in: tids } } });
  }
  // demo users / employees / agents
  const users = await prisma.user.findMany({ where: { username: { endsWith: "@demo.pk" } }, select: { id: true, employeeId: true } });
  const uids = users.map((u) => u.id);
  const empIds = (await prisma.employee.findMany({ where: { code: { startsWith: "DEMO-" } }, select: { id: true } })).map((e) => e.id);
  if (empIds.length) {
    await prisma.dailyReportComment.deleteMany({ where: { report: { employeeId: { in: empIds } } } }).catch(() => {});
    await prisma.dailyReport.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
    await prisma.salesAgent.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {});
  }
  if (uids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
    await prisma.featurePermission.deleteMany({ where: { parentId: { in: uids } } }).catch(() => {});
    await prisma.loggedInUsers.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  }
  await prisma.salesAgent.deleteMany({ where: { agentCode: { startsWith: "DMO-" } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { username: { endsWith: "@demo.pk" } } }).catch(() => {});
  await prisma.employee.deleteMany({ where: { code: { startsWith: "DEMO-" } } }).catch(() => {});
}

async function main() {
  await cleanupPriorDemo();
  const hash = await bcrypt.hash(PASSWORD, 6);
  const roleByName: Record<string, string> = {};
  for (const r of await prisma.role.findMany({ where: { isDeleted: null }, select: { id: true, name: true } })) roleByName[r.name] = r.id;

  console.log("[seedDemo] employees + users + roles...");
  const emp: Record<string, string> = {};   // key -> employeeId
  const usr: Record<string, string> = {};    // key -> userId
  let n = 1;
  for (const p of PEOPLE) {
    const e = await prisma.employee.create({ data: { name: p.name, surname: p.surname, code: `DEMO-${String(n).padStart(3, "0")}`, designation: p.desig, department: p.dept, contactNo: p.contact, ...EMP_BASE } as any });
    emp[p.key] = e.id;
    const u = await prisma.user.create({ data: { username: p.user, password: hash, employeeId: e.id, createdAt: new Date(), updatedAt: new Date() } });
    usr[p.key] = u.id;
    const rid = roleByName[p.role];
    if (rid) await prisma.userRole.create({ data: { id: randomUUID(), userId: u.id, roleId: rid, active: true, createdAt: new Date(), updatedAt: new Date() } });
    n++;
  }
  for (const p of EXTRA_EMP) {
    const e = await prisma.employee.create({ data: { name: p.name, surname: p.surname, code: `DEMO-${String(n).padStart(3, "0")}`, designation: p.desig, department: p.dept, contactNo: p.contact, ...EMP_BASE } as any });
    emp[p.key] = e.id; n++;
  }
  const adminId = usr["admin"];

  // everything below is attributed to the admin so History tabs show a real actor.
  await runWithContext({ userId: adminId, platform: "Admin" }, async () => {
    console.log("[seedDemo] sales agents (incl. Online Orders shared agent)...");
    const mgrAgent = await prisma.salesAgent.create({ data: { agentCode: "DMO-MGR", employeeId: emp["manager"], userId: usr["manager"], scope: "TEAM", monthlyTarget: 2000000, company: "OKASHASMART", isActive: true } as any });
    const agent = await prisma.salesAgent.create({ data: { agentCode: "DMO-AG1", employeeId: emp["agent"], userId: usr["agent"], scope: "OWN", teamLeadId: mgrAgent.id, monthlyTarget: 800000, commissionPct: 2.5, company: "OKASHASMART", isActive: true } as any });
    const aliAgent = await prisma.salesAgent.create({ data: { agentCode: "DMO-AG2", employeeId: emp["e_ali"], scope: "OWN", teamLeadId: mgrAgent.id, monthlyTarget: 600000, company: "OKASHASMART", isActive: true } as any });
    const onlineAgent = await prisma.salesAgent.create({ data: { agentCode: "DMO-ONLINE", employeeId: emp["e_usman"], scope: "ALL", company: "OKASHASMART", isActive: true } as any });

    // products for line items (prices are pending in catalogue, so set realistic prices here)
    const products = await prisma.product.findMany({ where: { isDeleted: null }, select: { id: true, name: true }, take: 12 });
    const prices = [18500, 24900, 32000, 15900, 45000, 28500, 21000, 36500, 12900, 19900, 27500, 33900];
    const realLeads = (await prisma.lead.findMany({ where: { isDeleted: null, customerName: { not: { startsWith: "QA" } } }, select: { id: true, customerName: true, phone: true }, take: 10 }));

    console.log("[seedDemo] CRM: demo leads with follow-ups...");
    const cities = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi", "Multan"];
    const leadNames = ["Ali Traders", "Hassan Electronics", "Zubair Hardware", "Mehmood & Sons", "Crescent Interiors", "Shalimar Builders", "Royal Homes", "Metro Appliances", "Khan Enterprises", "Elite Interiors", "Capital Smart Homes", "Lahore Door Centre", "Premier Fittings", "Noor Trading Co", "Gulberg Electronics", "DHA Smart Living", "Pak Tech Solutions", "Orient Hardware", "Sapphire Living", "Bahria Fit-outs"];
    const stages = ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION", "WON", "ON_HOLD"];
    const demoLeads: { id: string; customerName: string; phone: string }[] = [];
    for (let i = 0; i < 20; i++) {
      const stage = pick(stages, i);
      // a spread of follow-ups: some due today, some overdue, some upcoming
      const fu = i % 3 === 0 ? dayStart(now) : i % 3 === 1 ? addDays(dayStart(now), -(1 + (i % 4))) : addDays(dayStart(now), 2 + (i % 5));
      const l = await prisma.lead.create({ data: {
        customerName: pick(leadNames, i), phone: "0321" + String(2000000 + i), phoneNormalized: normalizePhone("0321" + String(2000000 + i)), city: pick(cities, i), stage: stage as any,
        priority: (["LOW", "MEDIUM", "HIGH"] as const)[i % 3], estimatedValue: 50000 + (i % 6) * 25000,
        channel: (["WALK_IN", "PHONE", "WHATSAPP", "REFERRAL"] as const)[i % 4], agentId: i % 5 === 0 ? aliAgent.id : agent.id,
        nextFollowUpAt: ["WON", "LOST"].includes(stage) ? null : fu, lastContactAt: addDays(dayStart(now), -(2 + (i % 5))),
        company: "OKASHASMART", sourceFile: "DEMO", dateReceived: addDays(dayStart(now), -(10 + i)),
      } as any });
      demoLeads.push({ id: l.id, customerName: l.customerName, phone: l.phone! });
    }

    console.log("[seedDemo] CRM: 15 quotations across statuses...");
    const qStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
    const quotes: { id: string; leadId: string | null; customerName: string; phone: string | null; total: number }[] = [];
    for (let i = 0; i < 15; i++) {
      // link half to real leads (as requested), half to demo leads
      const src = i % 2 === 0 && realLeads.length ? pick(realLeads, i) : pick(demoLeads, i);
      const itemsN = 1 + (i % 3);
      let subtotal = 0;
      const items = Array.from({ length: itemsN }, (_, k) => {
        const prod = pick(products, i + k); const up = pick(prices, i + k); const qty = 1 + (k % 2);
        const lineTotal = up * qty; subtotal += lineTotal;
        return { productId: prod.id, description: prod.name, quantity: qty, unitPrice: up, lineDiscount: 0, lineTotal };
      });
      const discount = i % 4 === 0 ? 2000 : 0;
      const q = await prisma.quotation.create({ data: {
        quotationNo: `QT-2026-${String(i + 1).padStart(3, "0")}`, version: 1, isActive: true, leadId: src.id,
        customerName: src.customerName, phone: src.phone, phoneNormalized: normalizePhone(src.phone), status: pick(qStatuses, i) as any, tier: "RETAIL",
        subtotal, discount, total: subtotal - discount, validUntil: addDays(now, 14), agentId: agent.id, company: "OKASHASMART",
        items: { create: items },
      } as any });
      quotes.push({ id: q.id, leadId: q.leadId, customerName: q.customerName, phone: q.phone, total: q.total });
    }

    console.log("[seedDemo] CRM: 10 orders across statuses...");
    const oStatuses = ["DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED", "DELIVERED", "CANCELLED", "RETURNED", "CONFIRMED", "DISPATCHED"];
    const couriers = ["PostEx", "TCS", "Leopards", "M&P"];
    const orders: { id: string; orderNo: string; customerName: string; phone: string | null; total: number; status: string }[] = [];
    for (let i = 0; i < 10; i++) {
      const src = pick(demoLeads, i + 3);
      const up = pick(prices, i); const qty = 1 + (i % 2); const subtotal = up * qty;
      const status = oStatuses[i];
      const o = await prisma.salesOrder.create({ data: {
        orderNo: `SO-2026-${String(i + 1).padStart(3, "0")}`, leadId: src.id, customerName: src.customerName, phone: src.phone, phoneNormalized: normalizePhone(src.phone),
        city: pick(cities, i), status: status as any, subtotal, discount: 0, total: subtotal,
        channel: (["WALK_IN", "PHONE", "ONLINE_STORE", "WHATSAPP"] as const)[i % 4], courier: pick(couriers, i),
        trackingNo: ["DISPATCHED", "DELIVERED", "RETURNED"].includes(status) ? "CN" + (10000 + i) : null,
        paymentType: (["COD", "ADVANCE", "PARTIAL"] as const)[i % 3], agentId: i % 4 === 0 ? onlineAgent.id : agent.id,
        dispatchedAt: ["DISPATCHED", "DELIVERED", "RETURNED"].includes(status) ? addDays(now, -(2 + i)) : null,
        deliveredAt: status === "DELIVERED" ? addDays(now, -(1 + i)) : null, company: "OKASHASMART",
        items: { create: [{ productId: pick(products, i).id, description: pick(products, i).name, quantity: qty, unitPrice: up, lineDiscount: 0, lineTotal: subtotal }] },
      } as any });
      orders.push({ id: o.id, orderNo: o.orderNo, customerName: o.customerName, phone: o.phone, total: o.total, status });
    }

    console.log("[seedDemo] CRM: returns...");
    const rStatuses = ["REPORTED", "RECEIVED_BACK", "RESTOCKED", "DAMAGED"];
    const delivered = orders.filter((o) => ["DELIVERED", "RETURNED"].includes(o.status));
    for (let i = 0; i < Math.min(4, delivered.length); i++) {
      const o = delivered[i];
      await prisma.salesReturn.create({ data: {
        returnNo: `RT-2026-${String(i + 1).padStart(3, "0")}`, orderId: o.id, customerName: o.customerName, phone: o.phone, phoneNormalized: normalizePhone(o.phone),
        status: pick(rStatuses, i) as any, reason: ["Wrong item delivered", "Customer changed mind", "Damaged in transit", "Not as described"][i % 4],
        courier: "TCS", agentId: agent.id, company: "OKASHASMART",
        items: { create: [{ description: "Returned unit", quantity: 1 }] },
      } as any });
    }

    console.log("[seedDemo] Work: teams, tasks, daily reports, notifications...");
    await seedWork(emp, usr, adminId);

    console.log("[seedDemo] a few edits so History tabs show changes...");
    // status change on two quotations + a lead stage move + an order status move
    await prisma.quotation.update({ where: { id: quotes[0].id }, data: { status: "ACCEPTED", statusReason: "Customer confirmed on call" } });
    await prisma.quotation.update({ where: { id: quotes[1].id }, data: { status: "SENT" } });
    if (demoLeads[2]) await prisma.lead.update({ where: { id: demoLeads[2].id }, data: { stage: "QUALIFIED", lastContactAt: now } });
    if (orders[0]) await prisma.salesOrder.update({ where: { id: orders[0].id }, data: { status: "CONFIRMED", statusReason: "Payment received" } });
  });

  const counts = {
    employees: await prisma.employee.count({ where: { code: { startsWith: "DEMO-" } } }),
    users: await prisma.user.count({ where: { username: { endsWith: "@demo.pk" } } }),
    agents: await prisma.salesAgent.count({ where: { agentCode: { startsWith: "DMO-" } } }),
    demoLeads: await prisma.lead.count({ where: { sourceFile: "DEMO" } }),
    quotations: await prisma.quotation.count({ where: { quotationNo: { startsWith: "QT-2026-" } } }),
    orders: await prisma.salesOrder.count({ where: { orderNo: { startsWith: "SO-2026-" } } }),
    returns: await prisma.salesReturn.count({ where: { returnNo: { startsWith: "RT-2026-" } } }),
    teams: await prisma.team.count({ where: { name: { in: ["Sales", "Operations", "HR"] } } }),
    tasks: await prisma.task.count(),
    dailyReports: await prisma.dailyReport.count(),
    auditLog: await prisma.auditLog.count(),
  };
  console.log("[seedDemo] DONE:", JSON.stringify(counts, null, 0));
  await prisma.$disconnect();
}

async function seedWork(emp: Record<string, string>, usr: Record<string, string>, adminId: string) {
  // 3 teams
  const sales = await prisma.team.create({ data: { name: "Sales", description: "Sales and lead follow-up", leadId: emp["manager"], company: "OKASHASMART", createdAt: new Date(), updatedAt: new Date() } as any });
  const ops = await prisma.team.create({ data: { name: "Operations", description: "Order fulfilment and dispatch", leadId: emp["lead"], company: "OKASHASMART", createdAt: new Date(), updatedAt: new Date() } as any });
  const hr = await prisma.team.create({ data: { name: "HR", description: "People and admin", leadId: emp["hr"], company: "OKASHASMART", createdAt: new Date(), updatedAt: new Date() } as any });
  const members: [string, string[]][] = [
    [sales.id, [emp["manager"], emp["agent"], emp["e_ali"]]],
    [ops.id, [emp["lead"], emp["employee"], emp["e_sara"], emp["e_usman"]]],
    [hr.id, [emp["hr"], emp["e_hina"]]],
  ];
  for (const [tid, mems] of members) {
    await prisma.teamMember.createMany({ data: mems.map((m) => ({ teamId: tid, employeeId: m, requiresDailyReport: true })) });
  }

  // 30 tasks across the Operations + Sales teams
  const teamFor = (i: number) => (i % 3 === 0 ? sales.id : ops.id);
  const statuses = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
  const prios = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  const titles = [
    "Follow up on Lahore bulk enquiry", "Prepare quotation for DHA project", "Dispatch pending COD orders",
    "Call customer about delayed delivery", "Restock returned door locks", "Update product price list",
    "Verify tracking for dispatched orders", "Reconcile cash on delivery", "Confirm outlet stock count",
    "Schedule installation visit", "Resolve RTO complaint", "Prepare weekly sales report",
    "Onboard new sales agent", "Review overdue follow-ups", "Package order SO-2026-005",
    "Check courier pickup", "Audit damaged returns", "Call Royal Homes for feedback",
    "Prepare demo units for expo", "Update CRM lead stages", "Train frontdesk on visitor log",
    "Monthly attendance review", "Confirm supplier delivery", "Draft service-center SOP",
    "Reply to WhatsApp enquiries", "Close won deals in CRM", "Inspect warehouse stock",
    "Plan Q1 sales targets", "Fix mislabeled products", "Daily dispatch summary",
  ];
  const assigneePool = [emp["agent"], emp["employee"], emp["e_ali"], emp["e_sara"], emp["e_usman"], emp["lead"]];
  let code = 1;
  for (let i = 0; i < 30; i++) {
    const tid = teamFor(i);
    const status = statuses[i % statuses.length];
    const due = i % 4 === 0 ? addDays(now, -(1 + (i % 5))) : i % 4 === 1 ? dayStart(now) : addDays(now, 2 + (i % 7));
    const task = await prisma.task.create({ data: {
      code: `TASK-${String(code++).padStart(4, "0")}`, title: titles[i], teamId: tid, status,
      priority: prios[i % prios.length] as any, dueDate: due, recurring: i % 7 === 0 ? "WEEKLY" : "NONE",
      completedAt: status === "DONE" ? addDays(now, -(i % 3)) : null, createdById: adminId, createdBy: adminId,
      company: "OKASHASMART", createdAt: new Date(), updatedAt: new Date(),
      labels: i % 2 === 0 ? ["sales"] : ["ops"],
    } as any });
    // assignees
    await prisma.taskAssignee.create({ data: { taskId: task.id, employeeId: pick(assigneePool, i) } });
    if (i % 3 === 0) await prisma.taskAssignee.create({ data: { taskId: task.id, employeeId: pick(assigneePool, i + 2) } }).catch(() => {});
    // checklist
    if (i % 2 === 0) await prisma.taskChecklistItem.createMany({ data: [
      { taskId: task.id, text: "Gather details", done: true, sortOrder: 0 },
      { taskId: task.id, text: "Take action", done: status === "DONE", sortOrder: 1 },
      { taskId: task.id, text: "Confirm with customer", done: false, sortOrder: 2 },
    ] });
    // comments
    if (i % 3 !== 2) await prisma.taskComment.create({ data: { taskId: task.id, userId: adminId, body: i % 2 === 0 ? "Please prioritise this today." : "Updated status after the call." } });
  }

  // daily reports for the Operations team, last 7 days, with a couple missing
  const opsMembers = [emp["lead"], emp["employee"], emp["e_sara"], emp["e_usman"]];
  for (let d = 1; d <= 7; d++) {
    const date = addDays(dayStart(now), -d);
    for (let m = 0; m < opsMembers.length; m++) {
      // leave a couple missing (member e_usman misses days 2 and 5)
      if (opsMembers[m] === emp["e_usman"] && (d === 2 || d === 5)) continue;
      await prisma.dailyReport.create({ data: {
        employeeId: opsMembers[m], date, whatIDid: pick(["Processed pending orders and updated tracking.", "Followed up on 6 leads and sent 2 quotations.", "Packed and dispatched COD orders.", "Handled returns and restocked items."], d + m),
        hours: 7 + (m % 2), blockers: d % 4 === 0 ? "Waiting on courier pickup" : null, planTomorrow: "Continue dispatch backlog.",
        late: d % 3 === 0, createdAt: new Date(), updatedAt: new Date(),
      } as any }).catch(() => {});
    }
  }

  // notifications for the agent + employee users
  const notes = [
    { userId: usr["agent"], type: "ASSIGNED", title: "Task assigned", body: "Prepare quotation for DHA project" },
    { userId: usr["agent"], type: "DUE_SOON", title: "Follow-up due today", body: "Hassan Electronics" },
    { userId: usr["employee"], type: "ASSIGNED", title: "Task assigned", body: "Dispatch pending COD orders" },
    { userId: usr["employee"], type: "REPORT_MISSING", title: "Daily report missing", body: "Please submit today's report" },
    { userId: usr["manager"], type: "OVERDUE", title: "Overdue task", body: "Reconcile cash on delivery" },
  ];
  await prisma.notification.createMany({ data: notes.map((x) => ({ ...x, createdAt: new Date() })) as any });
}

main().catch(async (e) => { console.error("[seedDemo] error", e); try { await prisma.$disconnect(); } catch { /* */ } process.exit(1); });
