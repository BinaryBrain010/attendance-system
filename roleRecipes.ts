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
  "Sales Agent": {
    description: "Own-scope selling: own leads/quotes/orders/returns, reports (no cost). Link to a SalesAgent with scope OWN.",
    features: [...CRM_AGENT_BASE],
  },
  "Sales Manager": {
    description: "Team-scope: everything a Sales Agent has, plus team reads and cost/margin. Link to a SalesAgent with scope TEAM.",
    features: [
      ...CRM_AGENT_BASE,
      "crm.lead.read.team.*", "crm.quotation.read.team.*", "crm.order.read.team.*", "crm.return.read.team.*",
      "crm.catalogue.cost.*",
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
      "crm.*",
    ],
  },
};

export type RoleName = keyof typeof ROLE_RECIPES;
