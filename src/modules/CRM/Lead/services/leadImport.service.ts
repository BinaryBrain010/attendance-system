/**
 * Lead register importer (both Okasha registers). DRY-RUN by default: parses, cleans, dedupes and
 * returns a report; only persists when dryRun=false. Cleaning rules follow Docs §8:
 *   - channel/stage/priority normalized to enums; ambiguous stage resolved via the Outcome column
 *     (Won->WON, Lost->LOST), else flagged for review (never assumed);
 *   - city normalized from the free-text Notes column; "Dummy ...lead" rows skipped and listed;
 *   - estimatedValue stripped of PKR/commas; computed columns (probability/weighted/days/follow-up)
 *     are DROPPED and recomputed at read time;
 *   - agent resolved from the AG### column to a SalesAgent; unresolved (e.g. AG007) -> agentId null
 *     and flagged;
 *   - both files imported, deduped by normalized phone + dateReceived; (sourceFile, legacyId) kept.
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

const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (s: string) => (s || "").replace(/\D/g, "");
const money = (s: string) => { const n = parseFloat(String(s || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

function cityOf(raw: string): string | null {
  const s = norm(raw);
  if (!s) return null;
  if (/krc|karachi/.test(s)) return "Karachi";
  if (/lhr|lahore|dha|askari|bahria|mm alam|firdous|wapda|valencia|faisal town|cantt|gujranwala|broadway/.test(s)) {
    if (/gujranwala/.test(s)) return "Gujranwala";
    return "Lahore";
  }
  if (/islamabad|isb/.test(s)) return "Islamabad";
  if (/chakwal/.test(s)) return "Chakwal";
  return raw.trim().slice(0, 60) || null;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); // dd-mm-yyyy
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(y, +m[2] - 1, +m[1]); return isNaN(+d) ? null : d; }
  m = t.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{2,4})$/); // dd-Mon-yyyy
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(`${m[1]} ${m[2]} ${y}`); return isNaN(+d) ? null : d; }
  const d = new Date(t); return isNaN(+d) ? null : d;
}

interface CleanRow {
  sourceFile: string; legacyId: string | null; customerName: string; phone: string | null; city: string | null;
  channel: string | null; stage: string; priority: string; estimatedValue: number | null; requirement: string | null;
  agentCode: string | null; agentId: string | null; dateReceived: Date | null; lastContactAt: Date | null;
  nextFollowUpAt: Date | null; outcomeRaw: string | null; company: string; dedupKey: string;
}

class LeadImportService {
  async run(files: SourceFile[], dryRun = true) {
    const agents = await prisma.salesAgent.findMany({ where: { isDeleted: null }, select: { id: true, agentCode: true } });
    const agentByCode: Record<string, string> = {};
    for (const a of agents) agentByCode[a.agentCode.toUpperCase()] = a.id;

    const perFile: Record<string, { rows: number; accepted: number; skipped: { row: number; id: string; reason: string }[] }> = {};
    const stageReview: { file: string; id: string; rawStage: string; outcome: string; resolved: string }[] = [];
    const agentFlags: { file: string; id: string; agentCode: string | null; reason: string }[] = [];
    const chanDist: Record<string, number> = {}, stageDist: Record<string, number> = {}, cityDist: Record<string, number> = {};
    const clean: CleanRow[] = [];

    for (const file of files) {
      const rows = parseCSV(file.csv);
      if (!rows.length) continue;
      const header = rows[0].map((h) => h.trim());
      const find = (re: RegExp) => header.findIndex((h) => re.test(h));
      const col = {
        id: find(/lead id/i), date: find(/date received/i), name: find(/customer name/i), phone: find(/phone|whatsapp/i),
        channel: find(/channel/i), product: find(/product/i), req: find(/requirement/i), sales: find(/salesperson/i),
        stage: find(/lead stage|^stage/i), prio: find(/priority/i), est: find(/estimated value/i),
        nextFu: find(/next follow/i), lastC: find(/last contact/i), outcome: find(/outcome/i), notes: find(/notes/i),
      };
      // agent-code column = the column whose values look like AG###
      let agentCol = -1;
      for (let c = 0; c < header.length; c++) {
        let hits = 0; for (let r = 1; r < Math.min(rows.length, 40); r++) if (/^AG\d{3}$/i.test((rows[r][c] || "").trim())) hits++;
        if (hits >= 2) { agentCol = c; break; }
      }
      perFile[file.name] = { rows: 0, accepted: 0, skipped: [] };

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c) => !String(c).trim())) continue;
        perFile[file.name].rows++;
        const id = (col.id >= 0 ? row[col.id] : "").trim();
        const name = (col.name >= 0 ? row[col.name] : "").trim();
        const notes = col.notes >= 0 ? row[col.notes] : "";
        if (/dummy.*lead/i.test(notes) || /dummy/i.test(name)) { perFile[file.name].skipped.push({ row: r + 1, id, reason: "dummy row" }); continue; }
        if (!name) { perFile[file.name].skipped.push({ row: r + 1, id, reason: "no customer name" }); continue; }

        const rawStage = (col.stage >= 0 ? row[col.stage] : "").trim();
        const outcome = (col.outcome >= 0 ? row[col.outcome] : "").trim();
        let stage = STAGE[norm(rawStage)];
        if (!stage) {
          const o = norm(outcome);
          if (o === "won") stage = "WON";
          else if (o === "lost") stage = "LOST";
          else { stage = "NEW"; stageReview.push({ file: file.name, id, rawStage: rawStage || "(blank)", outcome: outcome || "(blank)", resolved: "NEW (flagged)" }); }
          if (stage !== "NEW") stageReview.push({ file: file.name, id, rawStage: rawStage || "(blank)", outcome, resolved: `${stage} (from Outcome)` });
        }

        const agentCode = agentCol >= 0 ? (row[agentCol] || "").trim().toUpperCase() || null : null;
        let agentId: string | null = null;
        if (agentCode && agentByCode[agentCode]) agentId = agentByCode[agentCode];
        else if (agentCode) agentFlags.push({ file: file.name, id, agentCode, reason: "agent code not linked (import as unassigned)" });
        else agentFlags.push({ file: file.name, id, agentCode: null, reason: "no agent code" });

        const phone = (col.phone >= 0 ? row[col.phone] : "").trim() || null;
        const dateReceived = col.date >= 0 ? parseDate(row[col.date]) : null;
        const channel = CHANNEL[norm(col.channel >= 0 ? row[col.channel] : "")] || (col.channel >= 0 && row[col.channel]?.trim() ? "OTHER" : null);
        const city = cityOf(notes);
        const priority = PRIORITY[norm(col.prio >= 0 ? row[col.prio] : "")] || "MEDIUM";
        const est = col.est >= 0 ? money(row[col.est]) : null;

        chanDist[channel || "—"] = (chanDist[channel || "—"] || 0) + 1;
        stageDist[stage] = (stageDist[stage] || 0) + 1;
        if (city) cityDist[city] = (cityDist[city] || 0) + 1;

        clean.push({
          sourceFile: file.name, legacyId: id || null, customerName: name, phone, city, channel, stage, priority,
          estimatedValue: est, requirement: (col.req >= 0 ? row[col.req] : (col.product >= 0 ? row[col.product] : ""))?.trim() || null,
          agentCode, agentId, dateReceived, lastContactAt: col.lastC >= 0 ? parseDate(row[col.lastC]) : null,
          nextFollowUpAt: col.nextFu >= 0 ? parseDate(row[col.nextFu]) : null, outcomeRaw: outcome || null,
          company: "OKASHASMART",
          dedupKey: `${digits(phone || "")}|${dateReceived ? dateReceived.toISOString().slice(0, 10) : "?"}`,
        });
        perFile[file.name].accepted++;
      }
    }

    // dedup across files by phone+date
    const seen: Record<string, CleanRow> = {};
    const overlaps: { dedupKey: string; kept: string; dropped: string[] }[] = [];
    const unique: CleanRow[] = [];
    for (const row of clean) {
      if (row.dedupKey.startsWith("|") || row.dedupKey.endsWith("?")) { unique.push(row); continue; } // no phone/date -> cannot dedupe, keep
      const prev = seen[row.dedupKey];
      if (prev) {
        const o = overlaps.find((x) => x.dedupKey === row.dedupKey);
        const label = `${row.sourceFile}:${row.legacyId}`;
        if (o) o.dropped.push(label);
        else overlaps.push({ dedupKey: row.dedupKey, kept: `${prev.sourceFile}:${prev.legacyId}`, dropped: [label] });
      } else { seen[row.dedupKey] = row; unique.push(row); }
    }

    const report = {
      dryRun,
      files: Object.entries(perFile).map(([name, s]) => ({ name, rows: s.rows, accepted: s.accepted, skipped: s.skipped.length, skippedSample: s.skipped.slice(0, 20) })),
      totals: {
        parsedAccepted: clean.length, uniqueAfterDedup: unique.length, duplicatesDropped: clean.length - unique.length,
        unassigned: unique.filter((r) => !r.agentId).length, stageFlagged: stageReview.length,
      },
      channels: chanDist, stages: stageDist, cities: Object.fromEntries(Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 15)),
      agentFlags: { count: agentFlags.length, sample: agentFlags.slice(0, 20) },
      stageReview: { count: stageReview.length, sample: stageReview.slice(0, 20) },
      overlaps: { count: overlaps.length, sample: overlaps.slice(0, 20) },
      sample: unique.slice(0, 10).map((r) => ({ file: r.sourceFile, id: r.legacyId, name: r.customerName, stage: r.stage, city: r.city, channel: r.channel, agent: r.agentCode || "(unassigned)", est: r.estimatedValue })),
    };
    if (dryRun) return report;

    // ---- persist (NOT used in the dry-run deliverable) ----
    let created = 0, updated = 0;
    for (const r of unique) {
      const data = {
        customerName: r.customerName, phone: r.phone, city: r.city, channel: r.channel as any, stage: r.stage as any,
        priority: r.priority as any, estimatedValue: r.estimatedValue, requirement: r.requirement, agentId: r.agentId,
        dateReceived: r.dateReceived ?? new Date(), lastContactAt: r.lastContactAt, nextFollowUpAt: r.nextFollowUpAt,
        outcomeRaw: r.outcomeRaw, company: r.company as any, sourceFile: r.sourceFile, legacyId: r.legacyId,
      };
      if (r.legacyId) {
        const existing = await prisma.lead.findFirst({ where: { sourceFile: r.sourceFile, legacyId: r.legacyId } });
        if (existing) { await prisma.lead.update({ where: { id: existing.id }, data }); updated++; continue; }
      }
      await prisma.lead.create({ data }); created++;
    }
    return { ...report, persisted: { created, updated } };
  }
}

export default LeadImportService;
