/**
 * Lead register importer (both Okasha registers). DRY-RUN by default: parses, cleans, dedupes and
 * returns a report (incl. full detail arrays for the Excel export); only persists (in a transaction,
 * with before/after counts) when dryRun=false. Rules — Docs §8 + review decisions:
 *   1. Dates are parsed as PLAIN calendar dates (no UTC shift) — stored at UTC midnight so the
 *      calendar day never moves.
 *   2. Dates outside 2026-08-01..2026-10-31 are flagged; a day/month swap is tried first and used if
 *      it lands in range (flagged). Every fix is recorded for the "Date fixed" sheet.
 *   3. Dedup on phone+date keeps the MORE-ADVANCED stage and merges missing fields (agent, city,
 *      area, address, value) from the other row; if values differ a lot both are kept and flagged.
 *   4. Repeated header rows and junk names (AAA, single letters, no-letter names) are skipped.
 *   5. Known Lahore areas -> city Lahore + area; non-city values -> area, city null + flag.
 *   6. Generated codes continue the real OS-LHR-2026-#### sequence after the highest real ID.
 *   7. AG007 (Waleed) leads are reassigned to the manager AG006 and flagged; no-code rows stay unassigned.
 *   8. Full addresses go to `address`; short localities to `area`.
 */
import prisma from "../../../../core/models/base.model";

export interface SourceFile { name: string; csv: string; }

function parseCSV(t: string): string[][] {
  const rows: string[][] = []; let i = 0, f = "", row: string[] = [], q = false;
  t = t.replace(/^﻿/, "");
  while (i < t.length) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
    i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const CHANNEL: Record<string, string> = {
  "phone": "PHONE", "walk-in": "WALK_IN", "walkin": "WALK_IN", "walk in": "WALK_IN",
  "whatsapp": "WHATSAPP", "referral": "REFERRAL", "old customer": "REFERRAL",
  "social media": "SOCIAL_MEDIA", "offline marketing": "OFFLINE_MARKETING",
  "other (offline marketing)": "OFFLINE_MARKETING", "online store": "ONLINE_STORE", "other": "OTHER",
};
const STAGE: Record<string, string> = {
  "new lead": "NEW", "new": "NEW", "contacted": "CONTACTED", "qualified": "QUALIFIED",
  "quotation/proposal": "QUOTATION", "quotation": "QUOTATION", "proposal": "QUOTATION",
  "negotiation": "NEGOTIATION", "won": "WON", "lost": "LOST", "follow-up": "CONTACTED", "on hold": "ON_HOLD", "on-hold": "ON_HOLD",
};
const STAGE_RANK: Record<string, number> = { WON: 8, LOST: 8, NEGOTIATION: 6, QUOTATION: 5, QUALIFIED: 4, CONTACTED: 3, ON_HOLD: 2, NEW: 1, DRAFT: 0 };
const PRIORITY: Record<string, string> = { high: "HIGH", medium: "MEDIUM", low: "LOW" };
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Pakistan cities + common misspellings/abbreviations -> canonical name. NEVER default to Lahore.
const CITY_ALIAS: Record<string, string> = {
  "lahore": "Lahore", "lhr": "Lahore", "karachi": "Karachi", "khi": "Karachi", "krc": "Karachi",
  "islamabad": "Islamabad", "isb": "Islamabad", "rawalpindi": "Rawalpindi", "pindi": "Rawalpindi", "rwp": "Rawalpindi",
  "faisalabad": "Faisalabad", "faislabad": "Faisalabad", "lyallpur": "Faisalabad", "multan": "Multan",
  "peshawar": "Peshawar", "quetta": "Quetta", "hyderabad": "Hyderabad", "gujranwala": "Gujranwala", "gujrawala": "Gujranwala",
  "sialkot": "Sialkot", "gujrat": "Gujrat", "sargodha": "Sargodha", "bahawalpur": "Bahawalpur", "bahwalpur": "Bahawalpur",
  "okara": "Okara", "sahiwal": "Sahiwal", "abbottabad": "Abbottabad", "abbotabad": "Abbottabad", "mardan": "Mardan",
  "mianwali": "Mianwali", "chishtian": "Chishtian", "arifwala": "Arifwala", "burewala": "Burewala", "chakwal": "Chakwal",
  "sukkur": "Sukkur", "jhang": "Jhang", "sheikhupura": "Sheikhupura", "kasur": "Kasur", "rahim yar khan": "Rahim Yar Khan",
  "dera ghazi khan": "Dera Ghazi Khan", "dgkhan": "Dera Ghazi Khan", "muzaffargarh": "Muzaffargarh", "vehari": "Vehari",
  "khanewal": "Khanewal", "nankana": "Nankana Sahib", "wah": "Wah Cantt", "attock": "Attock", "jhelum": "Jhelum",
  "kohat": "Kohat", "bannu": "Bannu", "swat": "Swat", "mingora": "Mingora", "nowshera": "Nowshera", "charsadda": "Charsadda",
  "swabi": "Swabi", "haripur": "Haripur", "gilgit": "Gilgit", "skardu": "Skardu", "muzaffarabad": "Muzaffarabad",
  "mirpur": "Mirpur", "sadiqabad": "Sadiqabad", "jacobabad": "Jacobabad", "larkana": "Larkana", "nawabshah": "Nawabshah",
  "mirpurkhas": "Mirpurkhas", "toba tek singh": "Toba Tek Singh", "sahiwal city": "Sahiwal",
};
const CITY_ALIASES = Object.keys(CITY_ALIAS).sort((a, b) => b.length - a.length);
// Lahore sub-localities -> city Lahore (only when no explicit other city is present).
const LAHORE_AREA = /beadon\s*road|johar town|garden town|lake city|\bdha\b|askari|bahria|gulberg|model town|faisal town|wapda town|valencia|cantt|cavalry|firdous|mm alam|broadway|allama iqbal|iqbal town|township|walton|paragon|state life|eden|military accounts|jubilee|green ?town|defence/i;
const PURE_CITY = new RegExp(`^(${CITY_ALIASES.join("|")})$`, "i");
// text that is clearly a note (actions / products), not a location
const NOTE_RE = /order|payment|installation|install|visited|propose|proposal|quotation|scam|return|refund|out of stock|out of order|message|\bmsg\b|complaint|delivered|dispatch|courier|whatsapp|\bcall\b|site visit/i;
function looksNote(s: string): boolean { return NOTE_RE.test(s) || s.trim().split(/\s+/).length >= 7; }
function findCity(s: string): string | null {
  for (const al of CITY_ALIASES) { const re = new RegExp(`(^|[^a-z])${al.replace(/ /g, "\\s+")}([^a-z]|$)`, "i"); if (re.test(s)) return CITY_ALIAS[al]; }
  return null;
}

const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (s: string) => (s || "").replace(/\D/g, "");
const money = (s: string) => { const n = parseFloat(String(s || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

const DMIN = Date.UTC(2026, 7, 1);   // 2026-08-01
const DMAX = Date.UTC(2026, 9, 31);  // 2026-10-31
const inRange = (t: number) => t >= DMIN && t <= DMAX;
const mkUTC = (y: number, m: number, d: number) => { if (m < 1 || m > 12 || d < 1 || d > 31) return null; const t = Date.UTC(y, m - 1, d); const dt = new Date(t); return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? t : null; };

interface DateResult { date: Date | null; fix?: { field: string; from: string; to: string; reason: string } }
function parseDateEx(raw: string, field: string): DateResult {
  if (!raw || !raw.trim()) return { date: null };
  const t = raw.trim();
  let y = 0, mo = 0, da = 0, parsed = false;
  let m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) { da = +m[1]; mo = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; parsed = true; }
  else { m = t.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{2,4})$/); if (m) { da = +m[1]; mo = MONTHS[m[2].slice(0, 3).toLowerCase()] || 0; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; parsed = true; } }
  if (!parsed) { const d = new Date(t); if (isNaN(+d)) return { date: null }; const ut = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); return inRange(ut) ? { date: new Date(ut) } : { date: new Date(ut), fix: { field, from: t, to: iso(ut), reason: "out of range (kept)" } }; }
  const prim = mkUTC(y, mo, da);
  if (prim != null && inRange(prim)) return { date: new Date(prim) };
  const swap = mkUTC(y, da, mo);
  if (swap != null && inRange(swap)) return { date: new Date(swap), fix: { field, from: t, to: iso(swap), reason: "day/month swapped into range" } };
  const chosen = prim ?? swap;
  if (chosen == null) return { date: null };
  return { date: new Date(chosen), fix: { field, from: t, to: iso(chosen), reason: "out of range (flagged)" } };
}

function isJunkName(n: string): boolean {
  const s = (n || "").trim();
  if (!s) return true;
  if (!/[a-zA-Z]/.test(s)) return true;             // no letters
  if (/^[A-Za-z]$/.test(s)) return true;            // single letter
  if (/^([A-Za-z])\1{1,}$/.test(s)) return true;     // AAA, XXX, zzz
  if (/^(test|abc|asd|qwe|dummy)$/i.test(s)) return true;
  return false;
}

function classifyLocation(raw: string): { city: string | null; area: string | null; address: string | null; notes: string | null; flag: string | null } {
  const original = (raw || "").trim();
  const s = norm(original);
  if (!s) return { city: null, area: null, address: null, notes: null, flag: null };
  // explicit city name anywhere in the text/address wins; Lahore areas imply Lahore only if no city.
  let city = findCity(s);
  if (!city && LAHORE_AREA.test(s)) city = "Lahore";
  const note = looksNote(original);
  const looksAddress = original.length > 28 || (/\d/.test(original) && original.includes(",")) || /house|street|st no|road no|plot|block\s*\w|phase\s*\d/i.test(original);
  if (!city) {
    if (note) return { city: null, area: null, address: null, notes: original, flag: "free-text -> notes (city null)" };
    return looksAddress
      ? { city: null, area: null, address: original, notes: null, flag: "unknown city -> address (city null)" }
      : { city: null, area: original, address: null, notes: null, flag: "unknown city -> area (city null)" };
  }
  if (PURE_CITY.test(original)) return { city, area: null, address: null, notes: null, flag: null };
  if (note) return { city, area: null, address: null, notes: original, flag: null };
  return looksAddress ? { city, area: null, address: original, notes: null, flag: null } : { city, area: original, address: null, notes: null, flag: null };
}

interface CleanRow {
  sourceFile: string; legacyId: string; generatedId: boolean; customerName: string; phone: string | null;
  city: string | null; area: string | null; address: string | null; notes: string | null; locationFlag: string | null;
  channel: string | null; stage: string; stageFlagged: boolean; priority: string; estimatedValue: number | null;
  requirement: string | null; agentCode: string | null; agentId: string | null; agentFlag: string | null; finalAgent?: string;
  dateReceived: Date | null; lastContactAt: Date | null; nextFollowUpAt: Date | null; outcomeRaw: string | null;
  company: string; dedupKey: string; mergedFrom?: string[]; dupFlag?: string;
}

class LeadImportService {
  async run(files: SourceFile[], dryRun = true) {
    const agents = await prisma.salesAgent.findMany({ where: { isDeleted: null }, select: { id: true, agentCode: true } });
    const agentByCode: Record<string, string> = {};
    for (const a of agents) agentByCode[a.agentCode.toUpperCase()] = a.id;
    const ag006 = agentByCode["AG006"] || null;

    // pass 1: highest real OS-...-#### number, to continue generated codes
    let maxSeq = 0;
    const parsedFiles = files.map((f) => ({ name: f.name, rows: parseCSV(f.csv) }));
    for (const pf of parsedFiles) {
      const h = pf.rows[0]?.map((x) => x.trim()) || [];
      const idc = h.findIndex((x) => /lead id/i.test(x));
      if (idc < 0) continue;
      for (let r = 1; r < pf.rows.length; r++) {
        const m = (pf.rows[r][idc] || "").trim().match(/(\d+)\s*$/);
        if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
      }
    }
    let genSeq = maxSeq;
    const genCode = () => `OS-LHR-2026-${String(++genSeq).padStart(3, "0")}`;

    const perFile: Record<string, any> = {};
    let emptyRows = 0;
    const stageReview: any[] = [], agentFlagsList: any[] = [], dateFixes: any[] = [], locationFlags: any[] = [], reassigned: any[] = [];
    const chanDist: Record<string, number> = {}, stageDist: Record<string, number> = {}, cityDist: Record<string, number> = {};
    const clean: CleanRow[] = [];

    parsedFiles.forEach((pf, fileIdx) => {
      const rows = pf.rows; const file = pf.name;
      if (!rows.length) return;
      const header = rows[0].map((h) => h.trim());
      const find = (re: RegExp) => header.findIndex((h) => re.test(h));
      const col = {
        id: find(/lead id/i), date: find(/date received/i), name: find(/customer name/i), phone: find(/phone|whatsapp/i),
        channel: find(/channel/i), product: find(/product/i), req: find(/requirement/i),
        stage: find(/lead stage|^stage/i), prio: find(/priority/i), est: find(/estimated value/i),
        nextFu: find(/next follow/i), lastC: find(/last contact/i), outcome: find(/outcome/i), notes: find(/notes/i),
      };
      let agentCol = -1;
      for (let c = 0; c < header.length; c++) { let hits = 0; for (let r = 1; r < Math.min(rows.length, 40); r++) if (/^AG\d{3}$/i.test((rows[r][c] || "").trim())) hits++; if (hits >= 2) { agentCol = c; break; } }
      perFile[file] = { rows: 0, accepted: 0, withId: 0, generated: 0, skipped: [] as any[] };
      const pfr = perFile[file];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c) => !String(c).trim())) { emptyRows++; continue; }
        pfr.rows++;
        let id = (col.id >= 0 ? row[col.id] : "").trim();
        const name = (col.name >= 0 ? row[col.name] : "").trim();
        const notes = col.notes >= 0 ? row[col.notes] : "";
        const phone = (col.phone >= 0 ? row[col.phone] : "").trim() || null;
        const rawStage = (col.stage >= 0 ? row[col.stage] : "").trim();

        if (/^lead stage$/i.test(rawStage) || /^customer name$/i.test(name)) { pfr.skipped.push({ row: r + 1, id, name, reason: "repeated header row" }); continue; }
        if (/dummy.*lead/i.test(notes) || /dummy/i.test(name)) { pfr.skipped.push({ row: r + 1, id, name, reason: "dummy row" }); continue; }
        if (!name) { pfr.skipped.push({ row: r + 1, id, name, reason: "no customer name" }); continue; }
        if (isJunkName(name)) { pfr.skipped.push({ row: r + 1, id, name, reason: "junk name" }); continue; }

        let generatedId = false;
        if (!id) {
          if (phone && digits(phone).length >= 7) { id = genCode(); generatedId = true; }
          else { pfr.skipped.push({ row: r + 1, id: "", name, reason: "no Lead ID and no phone" }); continue; }
        }

        const outcome = (col.outcome >= 0 ? row[col.outcome] : "").trim();
        let stage = STAGE[norm(rawStage)]; let stageFlagged = false;
        if (!stage) {
          const o = norm(outcome);
          if (o === "won") { stage = "WON"; stageReview.push({ file, id, name, rawStage: rawStage || "(blank)", outcome, resolved: "WON (from Outcome)" }); }
          else if (o === "lost") { stage = "LOST"; stageReview.push({ file, id, name, rawStage: rawStage || "(blank)", outcome, resolved: "LOST (from Outcome)" }); }
          else { stage = "NEW"; stageFlagged = true; stageReview.push({ file, id, name, rawStage: rawStage || "(blank)", outcome: outcome || "(blank)", resolved: "NEW (flagged)" }); }
        }

        const agentCode = agentCol >= 0 ? (row[agentCol] || "").trim().toUpperCase() || null : null;
        let agentId: string | null = null, agentFlag: string | null = null;
        if (agentCode === "AG007") {
          if (ag006) { agentId = ag006; agentFlag = "reassigned from AG007 -> AG006"; reassigned.push({ file, id, name }); }
          else { agentFlag = "AG007 (manager AG006 not found) -> unassigned"; agentFlagsList.push({ file, id, name, agentCode, reason: agentFlag }); }
        } else if (agentCode && agentByCode[agentCode]) { agentId = agentByCode[agentCode]; }
        else { agentFlag = agentCode ? `agent ${agentCode} not linked -> unassigned` : "no agent code -> unassigned"; agentFlagsList.push({ file, id, name, agentCode: agentCode || "(none)", reason: agentFlag }); }

        const dR = col.date >= 0 ? parseDateEx(row[col.date], "dateReceived") : { date: null };
        const lC = col.lastC >= 0 ? parseDateEx(row[col.lastC], "lastContactAt") : { date: null };
        const nF = col.nextFu >= 0 ? parseDateEx(row[col.nextFu], "nextFollowUpAt") : { date: null };
        for (const dr of [dR, lC, nF]) if (dr.fix) dateFixes.push({ file, id, name, ...dr.fix });

        const channel = CHANNEL[norm(col.channel >= 0 ? row[col.channel] : "")] || (col.channel >= 0 && row[col.channel]?.trim() ? "OTHER" : null);
        const loc = classifyLocation(notes);
        if (loc.flag) locationFlags.push({ file, id, name, raw: notes.trim(), flag: loc.flag });
        const priority = PRIORITY[norm(col.prio >= 0 ? row[col.prio] : "")] || "MEDIUM";
        const est = col.est >= 0 ? money(row[col.est]) : null;

        chanDist[channel || "—"] = (chanDist[channel || "—"] || 0) + 1;
        stageDist[stage] = (stageDist[stage] || 0) + 1;
        if (loc.city) cityDist[loc.city] = (cityDist[loc.city] || 0) + 1;

        clean.push({
          sourceFile: file, legacyId: id, generatedId, customerName: name, phone, city: loc.city, area: loc.area, address: loc.address, notes: loc.notes, locationFlag: loc.flag,
          channel, stage, stageFlagged, priority, estimatedValue: est,
          requirement: (col.req >= 0 ? row[col.req] : (col.product >= 0 ? row[col.product] : ""))?.trim() || null,
          agentCode, agentId, agentFlag, dateReceived: dR.date, lastContactAt: lC.date, nextFollowUpAt: nF.date, outcomeRaw: outcome || null,
          company: "OKASHASMART", dedupKey: `${digits(phone || "")}|${dR.date ? dR.date.toISOString().slice(0, 10) : "?"}`,
        });
        pfr.accepted++; if (generatedId) pfr.generated++; else pfr.withId++;
      }
    });

    // ---- dedup: group by phone+date, keep advanced stage + merge, or keep both when values differ ----
    const groups: Record<string, CleanRow[]> = {};
    const unique: CleanRow[] = [];
    for (const row of clean) {
      if (!digits(row.phone || "") || row.dedupKey.endsWith("?")) { unique.push(row); continue; }
      (groups[row.dedupKey] ||= []).push(row);
    }
    const duplicates: any[] = [];
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      if (g.length === 1) { unique.push(g[0]); continue; }
      const stagesInGroup = new Set(g.map((r) => r.stage));
      const conflict = stagesInGroup.has("WON") && stagesInGroup.has("LOST");
      const vals = g.map((r) => r.estimatedValue).filter((v): v is number => v != null);
      const differ = vals.length >= 2 && (Math.max(...vals) - Math.min(...vals) > 100000 || (Math.min(...vals) > 0 && Math.max(...vals) / Math.min(...vals) >= 3));
      if (conflict || differ) {
        const why = conflict ? "conflicting outcome (WON vs LOST)" : "kept separate (values differ a lot)";
        g.forEach((r) => { r.dupFlag = why; unique.push(r); });
        duplicates.push({ resolution: conflict ? "kept-both (conflicting outcome)" : "kept-both (values differ)", rows: g });
      } else {
        const sorted = [...g].sort((a, b) => (STAGE_RANK[b.stage] || 0) - (STAGE_RANK[a.stage] || 0) || (b.estimatedValue || 0) - (a.estimatedValue || 0));
        const survivor = sorted[0]; const others = sorted.slice(1);
        for (const o of others) {
          if (!survivor.agentId && o.agentId) { survivor.agentId = o.agentId; survivor.agentCode = o.agentCode; survivor.agentFlag = o.agentFlag; }
          if (!survivor.city && o.city) survivor.city = o.city;
          if (!survivor.area && o.area) survivor.area = o.area;
          if (!survivor.address && o.address) survivor.address = o.address;
          if (survivor.estimatedValue == null && o.estimatedValue != null) survivor.estimatedValue = o.estimatedValue;
          if (!survivor.requirement && o.requirement) survivor.requirement = o.requirement;
        }
        survivor.mergedFrom = others.map((o) => `${o.sourceFile}:${o.legacyId}`);
        unique.push(survivor);
        duplicates.push({ resolution: "merged", kept: survivor, dropped: others });
      }
    }

    // final agent (resolved from the saved agentId; AG006 for reassigned AG007 rows) + per-agent counts
    const idToCode: Record<string, string> = {};
    for (const a of agents) idToCode[a.id] = a.agentCode;
    for (const r of unique) r.finalAgent = r.agentId ? (idToCode[r.agentId] || "AG?") : "(unassigned)";
    const perAgent: Record<string, number> = {};
    for (const r of unique) perAgent[r.finalAgent!] = (perAgent[r.finalAgent!] || 0) + 1;

    const droppedCount = duplicates.filter((d) => d.resolution === "merged").reduce((n, d) => n + d.dropped.length, 0);
    const unassigned = unique.filter((r) => !r.agentId);
    const nullCityRows = unique.filter((r) => !r.city);
    const conflictsKept = duplicates.filter((d) => String(d.resolution).includes("conflicting")).reduce((n, d) => n + d.rows.length, 0);
    const generated = unique.filter((r) => r.generatedId);
    const stageFlaggedRows = unique.filter((r) => r.stageFlagged);

    const report: any = {
      dryRun, highestRealId: maxSeq, generatedFrom: `OS-LHR-2026-${String(maxSeq + 1).padStart(3, "0")}`,
      files: Object.entries(perFile).map(([name, s]: any) => ({ name, rows: s.rows, accepted: s.accepted, withLeadId: s.withId, generatedId: s.generated, skipped: s.skipped.length })),
      totals: {
        emptyRowsIgnored: emptyRows, parsedAccepted: clean.length, uniqueAfterDedup: unique.length,
        duplicatesGroups: duplicates.length, duplicateRowsDropped: droppedCount, conflictsKept,
        withLeadId: unique.filter((r) => !r.generatedId).length, generatedId: generated.length,
        unassigned: unassigned.length, reassignedFromAG007: reassigned.length, nullCity: nullCityRows.length,
        stageFlagged: stageFlaggedRows.length, dateFixes: dateFixes.length, locationFlags: locationFlags.length,
      },
      perAgent, channels: chanDist, stages: stageDist, cities: Object.fromEntries(Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 20)),
      detail: {
        accepted: unique, duplicates, nullCity: nullCityRows,
        skipped: Object.entries(perFile).flatMap(([name, s]: any) => s.skipped.map((x: any) => ({ file: name, ...x }))),
        stageReview, unassigned, generated, reassigned, dateFixes, locationFlags, agentFlags: agentFlagsList,
      },
    };
    if (dryRun) return report;

    // ---- persist: transactional, with before/after counts (only when approved) ----
    const before = await prisma.lead.count();
    const res = await prisma.$transaction(async (tx) => {
      let created = 0, updated = 0;
      for (const r of unique) {
        const data = {
          customerName: r.customerName, phone: r.phone, city: r.city, area: r.area, address: r.address, notes: r.notes, channel: r.channel as any,
          stage: r.stage as any, priority: r.priority as any, estimatedValue: r.estimatedValue, requirement: r.requirement, agentId: r.agentId,
          dateReceived: r.dateReceived ?? new Date(), lastContactAt: r.lastContactAt, nextFollowUpAt: r.nextFollowUpAt,
          outcomeRaw: r.outcomeRaw, company: r.company as any, sourceFile: r.sourceFile, legacyId: r.legacyId,
        };
        const existing = await tx.lead.findFirst({ where: { sourceFile: r.sourceFile, legacyId: r.legacyId } });
        if (existing) { await tx.lead.update({ where: { id: existing.id }, data }); updated++; }
        else { await tx.lead.create({ data }); created++; }
      }
      return { created, updated };
    }, { timeout: 120000 });
    const after = await prisma.lead.count();
    return { ...report, persisted: { ...res, before, after } };
  }
}

export default LeadImportService;
