/**
 * Load test (LOCAL ONLY). A write workload — audit logging only affects writes, so this measures the
 * real cost of the same-transaction AuditLog insert. Uses a CASCADE-FREE write (lead create: one row
 * per request, no side effects) so the numbers reflect the write path, not a holiday->attendance
 * cascade. Self-cleaning (deletes its QA_LOAD leads + their audit rows). Rerunnable.
 *
 *   # audit on (default):
 *   RBAC_ENFORCE=on QA_BASE_URL=http://localhost:3002 npx ts-node qa/load.ts "audit-ON"
 *   # baseline (restart the server with AUDIT_LOG=0 first), then:
 *   RBAC_ENFORCE=on QA_BASE_URL=http://localhost:3002 npx ts-node qa/load.ts "audit-OFF"
 *
 * Env: LOAD_TOTAL (default 2000), LOAD_CONC (default 20).
 */
import { api, mintGodToken, IS_LOCAL } from "./lib";
import prisma from "../src/core/models/base.model";

if (!IS_LOCAL) { console.error("[load] refuse: non-local DB"); process.exit(2); }

const LABEL = process.argv[2] || "run";
const TOTAL = Number(process.env.LOAD_TOTAL || 2000);
const CONC = Number(process.env.LOAD_CONC || 20);

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const god = mintGodToken();
  const lat: number[] = [];
  let done = 0, errors = 0;

  const worker = async () => {
    while (true) {
      const n = done++;
      if (n >= TOTAL) return;
      const t0 = performance.now();
      try {
        const r = await api("POST", "/lead/create", god, { customerName: "QA_LOAD", phone: "0300" + (1000000 + (n % 9000000)), city: "Lahore" });
        if (r.status < 200 || r.status >= 300) errors++;
      } catch { errors++; }
      lat.push(performance.now() - t0);
    }
  };

  // warm-up (not measured)
  for (let i = 0; i < 50; i++) await api("POST", "/lead/create", god, { customerName: "QA_LOAD", phone: "0300" + (2000000 + i), city: "Lahore" });

  const start = performance.now();
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  const elapsed = (performance.now() - start) / 1000;

  lat.sort((a, b) => a - b);
  const mean = lat.reduce((a, b) => a + b, 0) / lat.length;
  console.log(`\n[load:${LABEL}] ${lat.length} writes, ${CONC} concurrent, ${elapsed.toFixed(1)}s, ${errors} errors`);
  console.log(`[load:${LABEL}] throughput ${(lat.length / elapsed).toFixed(0)} req/s`);
  console.log(`[load:${LABEL}] mean ${mean.toFixed(1)}ms  p50 ${pct(lat, 50).toFixed(1)}  p95 ${pct(lat, 95).toFixed(1)}  p99 ${pct(lat, 99).toFixed(1)}  max ${lat[lat.length - 1].toFixed(1)}`);

  // cleanup (audit off for the cleanup itself so the deletes do not log)
  process.env.AUDIT_LOG = "0";
  const ids = (await prisma.lead.findMany({ where: { customerName: "QA_LOAD" }, select: { id: true } })).map((l) => l.id);
  for (let i = 0; i < ids.length; i += 1000) {
    const slice = ids.slice(i, i + 1000);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: slice } } });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: slice } } });
  }
  if (ids.length) await prisma.lead.deleteMany({ where: { customerName: "QA_LOAD" } });
  console.log(`[load:${LABEL}] cleaned ${ids.length} QA_LOAD leads`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch { /* */ } process.exit(1); });
