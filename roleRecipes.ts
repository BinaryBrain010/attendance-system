/**
 * Role recipes — the canonical feature list for each named role. Pure data (no DB), imported by
 * `seedRoles.ts` (to create/update the Role rows + their FeaturePermission) and referenced by
 * `docs/PROD_DEPLOY_PLAN.md`. Edit the recipe here, re-run the seed, and the role is updated.
 *
 * Scope note (CRM): the read-scope leaf that is held drives the row filter — `read.all.*` = ALL,
 * `read.team.*` = TEAM (self + direct reports), `read.own.*` = OWN. A wildcard parent (e.g.
 * `crm.order.*`) grants every descendant incl. `read.all.*`, so `crm.order.*` means ALL scope on
 * orders. `SalesAgent.scope` can only narrow this, never widen it.
 */

// App-module umbrellas (navigation gates). Grant alongside the feature leaves a role needs.
export const APP_MODULES = {
  quickPass: "appModules.quickPass.*",
  quickMark: "appModules.quickMark.*",
  accessControl: "appModules.accessControl.*",
  frontdesk: "appModules.frontdesk.*",
  crm: "appModules.crm.*",
};

// Work module feature tiers. own = your own tasks + your daily report; team = your team's tasks and
// reports + manage teams; all = everything. appModules.work.* gates the Work menu + the bell.
const WORK_OWN = [
  "appModules.work.*",
  "work.task.read.own.*", "work.task.transition.*", "work.task.comment.*",
  "work.report.read.own.*", "work.report.submit.*",
];
const WORK_TEAM = [
  ...WORK_OWN,
  "work.team.read.*", "work.team.create.*", "work.team.update.*",
  "work.task.read.team.*", "work.task.create.*", "work.task.update.*", "work.task.assign.*", "work.task.delete.*",
  "work.report.read.team.*", "work.report.comment.*",
];
const WORK_ALL = ["appModules.work.*", "work.*"];

const CRM_AGENT_BASE = [
  "login.admin.*", "appModules.crm.*", "profile.*",
  "crm.catalogue.read.*", "crm.agent.read.*",
  "crm.lead.read.own.*", "crm.lead.create.*", "crm.lead.update.*", "crm.lead.transition.*", "crm.lead.assign.*",
  "crm.quotation.read.own.*", "crm.quotation.create.*", "crm.quotation.update.*", "crm.quotation.transition.*", "crm.quotation.export.*",
  "crm.order.read.own.*", "crm.order.create.*", "crm.order.update.*", "crm.order.transition.*", "crm.order.reattempt.*",
  "crm.return.read.own.*", "crm.return.create.*", "crm.return.update.*", "crm.return.transition.*",
  "crm.report.read.*", "crm.report.export.*",
];

export const ROLE_RECIPES: Record<string, { description: string; features: string[] }> = {
  "Employee": {
    description: "Any staff member: view and work their own tasks (move status, comment) and file their own daily report. No CRM. Link to their Employee; add to a Team to be expected to report.",
    features: ["login.admin.*", "profile.*", ...WORK_OWN],
  },
  "Team Lead": {
    description: "Leads one or more Teams: team-scope tasks (create, assign, manage) + their team's daily reports and compliance. Make them the Team's lead so TEAM scope resolves.",
    features: ["login.admin.*", "profile.*", "employee.read.*", ...WORK_TEAM],
  },
  "Sales Agent": {
    description: "Own-scope selling: own leads/quotes/orders/returns, reports (no cost). Own tasks + own daily report. Link to a SalesAgent with scope OWN.",
    features: [...CRM_AGENT_BASE, ...WORK_OWN],
  },
  "Sales Manager": {
    description: "Team-scope: everything a Sales Agent has, plus team reads, cost/margin, agent edits, catalogue management, and team-scope Work (tasks + daily reports). Link to a SalesAgent with scope TEAM.",
    features: [
      ...CRM_AGENT_BASE, ...WORK_TEAM,
      "crm.lead.read.team.*", "crm.quotation.read.team.*", "crm.order.read.team.*", "crm.return.read.team.*",
      "crm.catalogue.cost.*", "crm.catalogue.create.*", "crm.catalogue.update.*", "crm.agent.update.*",
    ],
  },
  "Order Ops": {
    description: "Order & return operations across ALL agents; NO lead access. ALL scope via the crm.order.* / crm.return.* wildcards. Needs no SalesAgent link.",
    features: [
      "login.admin.*", "appModules.crm.*", "profile.*",
      "crm.order.*",   // all order actions, ALL scope (incl. read.all.*)
      "crm.return.*",  // all return actions, ALL scope
      // optional context (uncomment if Order Ops should see product details / order reports):
      // "crm.catalogue.read.*", "crm.report.read.*",
    ],
  },
  "Frontdesk": {
    description: "Reception / visitor management.",
    features: ["login.admin.*", "appModules.frontdesk.*", "profile.*", "visitor.*", "employee.read.*"],
  },
  "HR": {
    description: "People ops: employees, attendance, leave, shifts, holidays, units.",
    features: [
      "login.admin.*", "appModules.quickMark.*", "profile.*", "analytics.*", "activityLog.*",
      "employee.*", "attendance.*", "attendanceReq.*",
      "leave.*", "leaveReq.*", "leaveAlloc.*", "leaveConfig.*",
      "holiday.*", "shift.*", "unit.*",
    ],
  },
  "Admin": {
    description: "Full access to every module (short of the hardcoded god account).",
    features: [
      "login.admin.*", "appModules.*", "profile.*", "setting.*", "systemConfig.*", "activityLog.*",
      "analytics.*", "voucher.*", "customer.*", "item.*",
      "user.*", "role.*", "group.*", "featurePermission.*",
      "employee.*", "shift.*", "attendance.*", "attendanceReq.*",
      "leave.*", "leaveReq.*", "leaveAlloc.*", "leaveConfig.*", "holiday.*", "visitor.*", "unit.*",
      "crm.*", "work.*",
    ],
  },
};

export type RoleName = keyof typeof ROLE_RECIPES;
