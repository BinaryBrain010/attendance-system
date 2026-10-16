/**
 * Ensures the System user row exists so that cron, import and seeder writes (which run inside
 * runAsSystem) have a real, resolvable actor id instead of a blank createdById. Idempotent.
 * Called once at server boot (server.ts) and by seeder.ts for fresh environments.
 */
import prisma from "../models/base.model";
import { SYSTEM_USER_ID, SYSTEM_USERNAME } from "../context/requestContext";

export async function ensureSystemUser(): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { id: SYSTEM_USER_ID },
      update: {},
      create: {
        id: SYSTEM_USER_ID,
        username: SYSTEM_USERNAME,
        // Not a login account: random unusable password hash placeholder. It holds no roles/grants.
        password: "!system-no-login!",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    // Non-fatal: audit stamping tolerates a missing actor, this only improves attribution.
    // eslint-disable-next-line no-console
    console.error("ensureSystemUser failed:", (e as Error)?.message);
  }
}

export default ensureSystemUser;
