/**
 * Builds qa/RBAC_Module_Test_Report.xlsx from qa/results.json.  npm run qa:report
 * 10 sheets: Summary, Modules & Endpoints, Feature Catalog, Personas, Test Matrix,
 * Permission Changes, UI Visibility, Multi User, Bugs & Security Findings, Gaps.
 * Styling: bold header row, thin borders, freeze panes, auto filter, green/red fill on Result.
 */
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const R = JSON.parse(fs.readFileSync(path.join(__dirname, "results.json"), "utf8"));
const INV = JSON.parse(fs.readFileSync(path.join(__dirname, "_inventory.json"), "utf8"));
const UIOBS = fs.existsSync(path.join(__dirname, "ui_observations.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "ui_observations.json"), "utf8"))
  : { personas: [], bugs: [], gaps: [] };

// Merge the live-UI findings into the bug/gap lists so they appear on those sheets.
const BUGS = [...R.bugs, ...(UIOBS.bugs || []).map((b: any, i: number) => ({ id: `UIB${String(i + 1).padStart(2, "0")}`, ...b }))];
const GAPS = [...R.gaps, ...(UIOBS.gaps || []).map((g: any, i: number) => ({ id: `UIG${String(i + 1).padStart(2, "0")}`, ...g }))];

const GREEN = "FFE2EFDA", RED = "FFFCE4E4", HEAD = "FF1F3864", AMBER = "FFFFF2CC";
const border = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const allBorders = { top: border, left: border, bottom: border, right: border };

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width: number }[], rows: any[], opts: { resultCol?: string; sevCol?: string } = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  // header style
  const hr = ws.getRow(1);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  hr.alignment = { vertical: "middle", horizontal: "left" };
  hr.height = 20;
  for (const row of rows) {
    const r = ws.addRow(row);
    r.alignment = { vertical: "top", wrapText: true };
    r.eachCell((cell) => { cell.border = allBorders; });
    if (opts.resultCol) {
      const v = String(row[opts.resultCol] || "");
      const fill = v === "Pass" ? GREEN : v === "Fail" ? RED : v === "Blocked" ? AMBER : null;
      if (fill) { const c = r.getCell(opts.resultCol); c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }; c.font = { bold: true }; }
    }
    if (opts.sevCol) {
      const v = String(row[opts.sevCol] || "");
      const fill = v === "Critical" ? "FFF4B183" : v === "High" ? RED : v === "Medium" ? AMBER : v === "Low" ? GREEN : null;
      if (fill) { const c = r.getCell(opts.sevCol); c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }; c.font = { bold: true }; }
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SolarMax QA harness";
  wb.created = new Date();

  const counts = R.meta.counts || {};
  const sev = BUGS.reduce((a: any, b: any) => { a[b.severity] = (a[b.severity] || 0) + 1; return a; }, {});
  const secFindings = R.matrix.filter((m: any) => /access WITHOUT|WRITE without/.test(m.scenario) && m.result === "Fail").length;

  // ---- 1. Summary ----
  const summaryRows = [
    { k: "Run started", v: R.meta.startedAt },
    { k: "Run finished", v: R.meta.finishedAt },
    { k: "Target", v: `${R.meta.base}  (DB: ${R.meta.db}); admin UI http://localhost:3001` },
    { k: "Live AppFeatures", v: String(R.meta.liveFeatures) },
    { k: "", v: "" },
    { k: "Tests PASS", v: String(counts.Pass || 0) },
    { k: "Tests FAIL", v: String(counts.Fail || 0) },
    { k: "Tests BLOCKED", v: String(counts.Blocked || 0) },
    { k: "Total test rows", v: String(R.matrix.length) },
    { k: "", v: "" },
    { k: "Bugs Critical", v: String(sev.Critical || 0) },
    { k: "Bugs High", v: String(sev.High || 0) },
    { k: "Bugs Medium", v: String(sev.Medium || 0) },
    { k: "Bugs Low", v: String(sev.Low || 0) },
    { k: "Gaps logged", v: String(GAPS.length) },
    { k: "", v: "" },
    { k: "Security findings (no-permission access)", v: `${secFindings} modules reachable without the gating feature` },
    { k: "", v: "" },
    { k: "HEADLINE FINDINGS", v: "" },
    { k: "1", v: "The backend is authenticated-only. There is no per-route permission check, so any valid token can read and change every module regardless of its RBAC features. RBAC today only shapes the UI." },
    { k: "2", v: "The server has no crash guard. Malformed requests to /auth/login (missing rememberMe) and to /leave/leave-configurations/update throw unhandled errors that stop the whole process (a denial-of-service risk)." },
    { k: "3", v: "Revoking a permission is not reflected in the permission list used to build the menu, so the UI keeps showing revoked modules. Only the live permission check honors the revoke." },
    { k: "4", v: "Unit scoping (unitIds in the token) filters attendance but not employee, attendance-request, leave, or analytics lists." },
    { k: "5", v: "AppFeature delete and restore always return 500 (the model methods are missing)." },
    { k: "6", v: "Admin navigation needs the appModules.* umbrella features in addition to the module features. A role given only employee/attendance/etc. sees no menu (confirmed live for HR and Mixed). The post-login home is hardcoded to /analytics and shows a 404 for users without analytics." },
    { k: "", v: "" },
    { k: "WHAT WORKS", v: "" },
    { k: "Login gating", v: "Platform-gated login (Mobile, Admin, Attendance App) is enforced correctly per the login.* feature." },
    { k: "Permission union", v: "Direct features plus roles plus groups plus roles-in-groups are combined correctly; the god user gets all features; unknown features are allowed by default (by design, but see finding)." },
    { k: "Workflows", v: "Mark attendance returns PRESENT/LATE/HALF_DAY correctly; attendance-request approval is permission-enforced and uses the submission time, not the approval time; leave approve and reject work; gate pass create, approve with signature, and PDF all work." },
    { k: "CRUD", v: "Create, read, update, soft-delete and restore verified as god across all core modules (except AppFeature delete/restore)." },
    { k: "Logout and concurrency", v: "Logout blacklists the token. Concurrent checkout/update/approve of the same record are handled without a 5xx (no optimistic locking, logged as a gap)." },
  ];
  const sws = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  sws.columns = [{ header: "Metric / Finding", key: "k", width: 42 }, { header: "Value", key: "v", width: 120 }];
  const shr = sws.getRow(1); shr.font = { bold: true, color: { argb: "FFFFFFFF" } }; shr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  for (const row of summaryRows) {
    const r = sws.addRow(row);
    r.alignment = { vertical: "top", wrapText: true };
    if (["HEADLINE FINDINGS", "WHAT WORKS"].includes(row.k)) r.font = { bold: true, size: 12 };
  }

  // ---- 2. Modules & Endpoints ----
  sheet(wb, "Modules & Endpoints",
    [{ header: "Module", key: "module", width: 18 }, { header: "Method", key: "method", width: 9 }, { header: "Path", key: "path", width: 42 }, { header: "Kind", key: "kind", width: 12 }, { header: "Should be guarded by", key: "guard", width: 40 }, { header: "Open (no auth)", key: "open", width: 14 }],
    R.endpoints.map((e: any) => ({ ...e, open: e.open ? "yes" : "" })));

  // ---- 3. Feature Catalog ----
  sheet(wb, "Feature Catalog",
    [{ header: "Feature", key: "feature", width: 40 }, { header: "Bucket", key: "parent", width: 22 }, { header: "In staticData", key: "inStaticData", width: 14 }, { header: "In live DB", key: "inDB", width: 11 }, { header: "Assignable in UI", key: "assignableInUI", width: 16 }, { header: "Used in Admin", key: "usedInAdmin", width: 14 }, { header: "Used in Mobile", key: "usedInMobile", width: 14 }],
    R.featureCatalog, { resultCol: "assignableInUI" });

  // ---- 4. Personas ----
  sheet(wb, "Personas",
    [{ header: "Persona", key: "user", width: 26 }, { header: "Login (email)", key: "email", width: 34 }, { header: "Platforms allowed", key: "platforms", width: 22 }, { header: "Direct features", key: "direct", width: 34 }, { header: "Groups", key: "groups", width: 20 }, { header: "Roles", key: "roles", width: 22 }, { header: "unitIds", key: "unitIds", width: 16 }, { header: "Expected effective features", key: "expectedFeatures", width: 70 }, { header: "Note", key: "note", width: 40 }],
    R.personas);

  // ---- 5. Test Matrix ----
  sheet(wb, "Test Matrix",
    [{ header: "ID", key: "id", width: 8 }, { header: "Module", key: "module", width: 18 }, { header: "Persona", key: "persona", width: 24 }, { header: "Scenario", key: "scenario", width: 34 }, { header: "Steps", key: "steps", width: 40 }, { header: "Expected", key: "expected", width: 26 }, { header: "Actual", key: "actual", width: 26 }, { header: "Status", key: "status", width: 9 }, { header: "Result", key: "result", width: 10 }, { header: "Notes", key: "notes", width: 60 }],
    R.matrix, { resultCol: "result" });

  // ---- 6. Permission Changes ----
  sheet(wb, "Permission Changes",
    [{ header: "Scenario", key: "scenario", width: 44 }, { header: "Before", key: "before", width: 40 }, { header: "Action", key: "action", width: 40 }, { header: "After", key: "after", width: 40 }, { header: "Expected", key: "expected", width: 30 }, { header: "Result", key: "result", width: 10 }],
    R.permChanges, { resultCol: "result" });

  // ---- 7. UI Visibility (LIVE browser logins against localhost:3001; actual vs expected) ----
  const uiRows = (UIOBS.personas || []).map((p: any) => ({
    user: p.persona, login: p.login, expectedNav: p.expectedNav, actualNav: p.actualNav, result: p.match,
  }));
  const uiWs = sheet(wb, "UI Visibility",
    [{ header: "Persona", key: "user", width: 26 }, { header: "Login", key: "login", width: 10 }, { header: "Expected nav / access", key: "expectedNav", width: 55 }, { header: "Actual nav / access (observed live)", key: "actualNav", width: 70 }, { header: "Result", key: "result", width: 30 }],
    uiRows);
  // append the nav gating map as context rows
  uiWs.addRow({});
  uiWs.addRow({ user: "NAV GATING MAP", login: "", expectedNav: "feature that controls the menu group", actualNav: "", result: "" }).font = { bold: true };
  for (const [grp, gate] of Object.entries(UIOBS.navGatingMap || {})) {
    uiWs.addRow({ user: grp, expectedNav: String(gate) });
  }

  // ---- 8. Multi User ----
  sheet(wb, "Multi User",
    [{ header: "Scenario", key: "scenario", width: 46 }, { header: "Users", key: "users", width: 26 }, { header: "Expected", key: "expected", width: 40 }, { header: "Actual", key: "actual", width: 30 }, { header: "Result", key: "result", width: 10 }],
    R.multiUser, { resultCol: "result" });

  // ---- 9. Bugs & Security Findings ----
  sheet(wb, "Bugs & Security Findings",
    [{ header: "ID", key: "id", width: 9 }, { header: "Severity", key: "severity", width: 11 }, { header: "Module", key: "module", width: 22 }, { header: "Description", key: "description", width: 85 }, { header: "Repro", key: "repro", width: 55 }, { header: "Suggested fix", key: "fix", width: 60 }, { header: "Files", key: "files", width: 50 }],
    BUGS, { sevCol: "severity" });

  // ---- 10. Gaps ----
  sheet(wb, "Gaps",
    [{ header: "ID", key: "id", width: 9 }, { header: "Kind", key: "kind", width: 24 }, { header: "Detail", key: "detail", width: 60 }, { header: "Impact", key: "impact", width: 80 }],
    GAPS);

  const out = path.join(__dirname, "RBAC_Module_Test_Report.xlsx");
  await wb.xlsx.writeFile(out);
  console.log(`[QA report] wrote ${out}  (${wb.worksheets.length} sheets)`);
}
main().catch((e) => { console.error("[QA report] error", e); process.exit(1); });
