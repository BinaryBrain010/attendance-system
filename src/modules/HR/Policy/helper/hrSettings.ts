/** HR-policy settings, stored in their own SystemConfig row (id "hr-policy") — isolated from AMS config. */
import prisma from "../../../../core/models/base.model";

const HR_CONFIG_ID = "hr-policy";

export interface HrSettings {
  probationMonths: number; // global default probation length (months) — default 3
  entitlementProRata: boolean; // pro-rate entitlement across a mid-year band crossing — default false
  hrManagerRoleName: string | null; // if set, this role's users are the HR managers notified; else hr.policy.manage.* holders
}

export const DEFAULT_HR_SETTINGS: HrSettings = {
  probationMonths: 3,
  entitlementProRata: false,
  hrManagerRoleName: null,
};

export async function getHrSettings(): Promise<HrSettings> {
  const row = await prisma.systemConfig.findUnique({ where: { id: HR_CONFIG_ID } });
  const stored = ((row?.config as any) || {}) as Partial<HrSettings>;
  return { ...DEFAULT_HR_SETTINGS, ...stored };
}

export async function updateHrSettings(updates: Partial<HrSettings>): Promise<HrSettings> {
  const merged = { ...(await getHrSettings()), ...updates };
  await prisma.systemConfig.upsert({
    where: { id: HR_CONFIG_ID },
    update: { config: merged as any },
    create: { id: HR_CONFIG_ID, config: merged as any },
  });
  return merged;
}
