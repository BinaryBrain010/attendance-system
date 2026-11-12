/** HR-policy settings, stored in their own SystemConfig row (id "hr-policy") — isolated from AMS config. */
import prisma from "../../../../core/models/base.model";

const HR_CONFIG_ID = "hr-policy";

export interface HrSettings {
  probationMonths: number; // global default probation length (months) — default 3
  entitlementProRata: boolean; // pro-rate entitlement across a mid-year band crossing — default false
  hrManagerRoleName: string | null; // if set, this role's users are the HR managers notified; else hr.policy.manage.* holders
  // Probation tracking applies only to genuine new hires: an employee is "on probation" if their
  // status is PROBATION, or they joined ON/AFTER this date. Legacy staff (joined before it, status
  // not PROBATION) are never tracked or alerted. null => only explicit PROBATION-status employees.
  probationPolicyStartDate: string | null;
  // The LeaveConfiguration the policy's ANNUAL entitlement represents. When set, the POLICY allocation
  // is created with this leaveConfigId, and apply skips (never doubles) when an allocation of this
  // type already exists for the year. null => auto-detect by config name containing "annual".
  annualLeaveConfigId: string | null;
}

export const DEFAULT_HR_SETTINGS: HrSettings = {
  probationMonths: 3,
  entitlementProRata: false,
  hrManagerRoleName: null,
  probationPolicyStartDate: null,
  annualLeaveConfigId: null,
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
