/**
 * Lead register importer (both Okasha registers). DRY-RUN by default: parses, cleans, dedupes and
 * returns a report (incl. full detail arrays for the Excel export); only persists when dryRun=false.
 * Rules (Docs §8 + user decisions):
 *   - channel/stage/priority normalized to enums; ambiguous stage resolved via the Outcome column
 *     (Won->WON, Lost->LOST), else NEW and flagged (never assumed);
 *   - city normalized to CITY + AREA (e.g. "Johar Town" -> city Lahore, area "Johar Town");
 *   - a row is accepted when it has a customer name AND (a Lead ID OR a phone); a named row with a
 *     phone but no Lead ID gets a GENERATED code and is flagged; a named row with neither is skipped;
 *     "Dummy ...lead" rows are skipped. All skips are listed with a reason;
 *   - estimatedValue stripped of PKR/commas; computed columns dropped;
 *   - agent resolved from the AG### column; unresolved (e.g. AG007) -> agentId null and flagged;
 *   - both files deduped by normalized phone + dateReceived, keeping (sourceFile, legacyId); the
 *     dropped row is kept alongside the survivor for review.
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
const PRIORITY: Record<string, string> = { high: "HIGH", medium: "MEDIUM", low: "LOW" };

// Lahore sub-localities -> city Lahore, area = the original text.
const LAHORE_AREA = /dha|johar town|garden town|lake city|askari|bahria|model town|gulberg|faisal town|wapda town|valencia|cantt|cavalry|firdous|mm alam|broadway|allama iqbal|iqbal town|township|walton|wapda|ex ?park ?view|paragon|state life|eden|military accounts|jubilee|green ?town/i;
const LAHORE_CITY = /^(lhr|lahore)$/i;

const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (s: string) => (s || "").replace(/\D/g, "");
const money = (s: string) => { const n = parseFloat(String(s || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

function cityArea(raw: string): { city: string | null; area: string | null } {
  const original = (raw || "").trim();
  const s = norm(original);
  if (!s) return { city: null, area: null };
  if (/krc|karachi/.test(s)) return { city: "Karachi", area: LAHORE_CITY.test(original) ? null : (/(karachi|krc)/i.test(original) && original.length <= 8 ? null : original) };
  if (LAHORE_CITY.test(original)) return { city: "Lahore", area: null };
  if (LAHORE_AREA.test(s) || /lhr|lahore/.test(s)) return { city: "Lahore", area: original.length > 2 ? original : null };
  if (/gujranwala/.test(s)) return { city: "Gujranwala", area: null };
  if (/islamabad|isb/.test(s)) return { city: "Islamabad", area: null };
  if (/chakwal/.test(s)) return { city: "Chakwal", area: null };
  return { city: original.slice(0, 60) || null, area: null };
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(y, +m[2] - 1, +m[1]); return isNaN(+d) ? null : d; }
  m = t.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(`${m[1]} ${m[2]} ${y}`); return isNaN(+d) ? null : d; }
  const d = new Date(t); return isNaN(+d) ? null : d;
}

interface CleanRow {
  sourceFile: string; legacyId: string | null; generatedId: boolean; customerName: string; phone: string | null;
  city: string | null; area: string | null; channel: string | null; stage: string; stageFlagged: boolean;
  priority: string; estimatedValue: number | null; requirement: string | null; agentCode: string | null;
  agentId: string | null; dateReceived: Date | null; lastContactAt: Date | null; nextFollowUpAt: Date | null;
  outcomeRaw: string | null; company: string; dedupKey: string;
}

class LeadImportService {
  async run(files: SourceFile[], dryRun = true) {
    const agents = await prisma.salesAgent.findMany({ where: { isDeleted: null }, select: { id: true, agentCode: true } });
    const agentByCode: Record<string, string> = {};
    for (const a of agents) agentByCode[a.agentCode.toUpperCase()] = a.id;

    const perFile: Record<string, { rows: number; accepted: number; withId: number; generated: number; skipped: { row: number; id: string; name: string; reason: string }[] }> = {};
    const stageReview: any[] = [];
    const agentFlags: any[] = [];
    const chanDist: Record<string, number> = {}, stageDist: Record<string, number> = {}, cityDist: Record<string, number> = {};
    const clean: CleanRow[] = [];

    files.forEach((file, fileIdx) => {
      const rows = parseCSV(file.csv);
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
      for (let c = 0; c < header.length; c++) {
        let hits = 0; for (let r = 1; r < Math.min(rows.length, 40); r++) if (/^AG\d{3}$/i.test((rows[r][c] || "").trim())) hits++;
        if (hits >= 2) { agentCol = c; break; }
      }
      perFile[file.name] = { rows: 0, accepted: 0, withId: 0, generated: 0, skipped: [] };
      const pf = perFile[file.name];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c) => !String(c).trim())) continue;
        pf.rows++;
        let id = (col.id >= 0 ? row[col.id] : "").trim();
        const name = (col.name >= 0 ? row[col.name] : "").trim();
        const notes = col.notes >= 0 ? row[col.notes] : "";
        const phone = (col.phone >= 0 ? row[col.phone] : "").trim() || null;

        if (/dummy.*lead/i.test(notes) || /dummy/i.test(name)) { pf.skipped.push({ row: r + 1, id, name, reason: "dummy row" }); continue; }
        if (!name) { pf.skipped.push({ row: r + 1, id, name, reason: "no customer name" }); continue; }
        // blank Lead ID: import only if a phone exists (generate a code); else skip
        let generatedId = false;
        if (!id) {
          if (phone && digits(phone).length >= 7) { id = `GEN-${fileIdx}-${r + 1}`; generatedId = true; }
          else { pf.skipped.push({ row: r + 1, id: "", name, reason: "no Lead ID and no phone" }); continue; }
        }

        const rawStage = (col.stage >= 0 ? row[col.stage] : "").trim();
        const outcome = (col.outcome >= 0 ? row[col.outcome] : "").trim();
        let stage = STAGE[norm(rawStage)];
        let stageFlagged = false;
        if (!stage) {
          const o = norm(outcome);
          if (o === "won") { stage = "WON"; stageReview.push({ file: file.name, id, name, rawStage: rawStage || "(blank)", outcome, resolved: "WON (from Outcome)" }); }
          else if (o === "lost") { stage = "LOST"; stageReview.push({ file: file.name, id, name, rawStage: rawStage || "(blank)", outcome, resolved: "LOST (from Outcome)" }); }
          else { stage = "NEW"; stageFlagged = true; stageReview.push({ file: file.name, id, name, rawStage: rawStage || "(blank)", outcome: outcome || "(blank)", resolved: "NEW (flagged)" }); }
        }

        const agentCode = agentCol >= 0 ? (row[agentCol] || "").trim().toUpperCase() || null : null;
        let agentId: string | null = null;
        if (agentCode && agentByCode[agentCode]) agentId = agentByCode[agentCode];
        else agentFlags.push({ file: file.name, id, name, agentCode: agentCode || "(none)", reason: agentCode ? "agent code not linked -> unassigned" : "no agent code" });

        const dateReceived = col.date >= 0 ? parseDate(row[col.date]) : null;
        const channel = CHANNEL[norm(col.channel >= 0 ? row[col.channel] : "")] || (col.channel >= 0 && row[col.channel]?.trim() ? "OTHER" : null);
        const { city, area } = cityArea(notes);
        const priority = PRIORITY[norm(col.prio >= 0 ? row[col.prio] : "")] || "MEDIUM";
        const est = col.est >= 0 ? money(row[col.est]) : null;

        chanDist[channel || "—"] = (chanDist[channel || "—"] || 0) + 1;
        stageDist[stage] = (stageDist[stage] || 0) + 1;
        if (city) cityDist[city] = (cityDist[city] || 0) + 1;

        clean.push({
          sourceFile: file.name, legacyId: id, generatedId, customerName: name, phone, city, area, channel, stage, stageFlagged,
          priority, estimatedValue: est, requirement: (col.req >= 0 ? row[col.req] : (col.product >= 0 ? row[col.product] : ""))?.trim() || null,
          agentCode, agentId, dateReceived, lastContactAt: col.lastC >= 0 ? parseDate(row[col.lastC]) : null,
          nextFollowUpAt: col.nextFu >= 0 ? parseDate(row[col.nextFu]) : null, outcomeRaw: outcome || null, company: "OKASHASMART",
          dedupKey: `${digits(phone || "")}|${dateReceived ? dateReceived.toISOString().slice(0, 10) : "?"}`,
        });
        pf.accepted++;
        if (generatedId) pf.generated++; else pf.withId++;
      }
    });

    // dedup across files by phone+date (keep survivor, record the dropped row in full)
    const seen: Record<string, CleanRow> = {};
    const duplicates: { kept: CleanRow; dropped: CleanRow }[] = [];
    const unique: CleanRow[] = [];
    for (const row of clean) {
      if (!digits((row.phone) || "") || row.dedupKey.endsWith("?")) { unique.push(row); continue; }
      const prev = seen[row.dedupKey];
      if (prev) duplicates.push({ kept: prev, dropped: row });
      else { seen[row.dedupKey] = row; unique.push(row); }
    }

    const unassigned = unique.filter((r) => !r.agentId);
    const generated = unique.filter((r) => r.generatedId);
    const stageFlaggedRows = unique.filter((r) => r.stageFlagged);

    const report: any = {
      dryRun,
      files: Object.entries(perFile).map(([name, s]) => ({ name, rows: s.rows, accepted: s.accepted, withLeadId: s.withId, generatedId: s.generated, skipped: s.skipped.length })),
      totals: {
        parsedAccepted: clean.length, uniqueAfterDedup: unique.length, duplicatesDropped: duplicates.length,
        withLeadId: unique.filter((r) => !r.generatedId).length, generatedId: generated.length,
        unassigned: unassigned.length, stageFlagged: stageFlaggedRows.length,
      },
      channels: chanDist, stages: stageDist,
      cities: Object.fromEntries(Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 15)),
      sample: unique.slice(0, 10).map((r) => ({ file: r.sourceFile, id: r.legacyId, gen: r.generatedId, name: r.customerName, stage: r.stage, city: r.city, area: r.area, channel: r.channel, agent: r.agentCode || "(unassigned)", est: r.estimatedValue })),
      // full detail for the Excel export (not sliced)
      detail: { accepted: unique, duplicates, skipped: Object.entries(perFile).flatMap(([name, s]) => s.skipped.map((x) => ({ file: name, ...x }))), stageReview, unassigned, generated, agentFlags },
    };
    if (dryRun) return report;

    // ---- persist (NOT used in the dry-run deliverable) ----
    let created = 0, updated = 0;
    for (const r of unique) {
      const data = {
        customerName: r.customerName, phone: r.phone, city: r.city, area: r.area, channel: r.channel as any, stage: r.stage as any,
        priority: r.priority as any, estimatedValue: r.estimatedValue, requirement: r.requirement, agentId: r.agentId,
        dateReceived: r.dateReceived ?? new Date(), lastContactAt: r.lastContactAt, nextFollowUpAt: r.nextFollowUpAt,
        outcomeRaw: r.outcomeRaw, company: r.company as any, sourceFile: r.sourceFile, legacyId: r.legacyId,
      };
      const existing = await prisma.lead.findFirst({ where: { sourceFile: r.sourceFile, legacyId: r.legacyId } });
      if (existing) { await prisma.lead.update({ where: { id: existing.id }, data }); updated++; }
      else { await prisma.lead.create({ data }); created++; }
    }
    return { ...report, persisted: { created, updated } };
  }
}

export default LeadImportService;
