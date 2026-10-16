/**
 * Boot-time audit safety check (Run 12 item 4). Audit logging defaults ON. If it has been turned
 * off (AUDIT_LOG=0) while running in production, that is almost certainly a mistake: log a loud
 * warning and record a SYSTEM audit event noting the gap (logEvent writes directly, so it is NOT
 * suppressed by AUDIT_LOG=0 and the "audit is off" fact is itself recorded).
 */
import logger from "../logger/logger";
import { logEvent } from "./event";
import { runAsSystem } from "../context/requestContext";

export async function auditBootCheck(): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  const auditOff = process.env.AUDIT_LOG === "0";
  if (!auditOff) return; // audit on -> nothing to warn about

  const banner =
    "============================================================\n" +
    "  WARNING: AUDIT LOGGING IS DISABLED (AUDIT_LOG=0)\n" +
    (isProd
      ? "  NODE_ENV=production — business writes will NOT be recorded\n  in the audit trail. Unset AUDIT_LOG to re-enable.\n"
      : "  (non-production) audit trail writes are suppressed.\n") +
    "============================================================";
  logger.error(banner);

  if (isProd) {
    try {
      await runAsSystem(() => logEvent({
        module: "System", entity: "AuditLog", action: "PERMISSION_CHANGE",
        changes: { auditDisabled: true, nodeEnv: "production", note: "AUDIT_LOG=0 at boot — audit trail is OFF" },
      }));
    } catch (e) {
      logger.error(`auditBootCheck: failed to record the audit-disabled SYSTEM event: ${(e as Error)?.message}`);
    }
  }
}

export default auditBootCheck;
