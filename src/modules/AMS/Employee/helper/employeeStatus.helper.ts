/**
 * Single source of truth for "former" vs "active" employees. A former employee is one who has left —
 * resigned or fired/terminated (the only exit statuses in the EmployeeStatus enum: RESIGNED, FIRE).
 * ACTIVE, REJOINED and PROBATION are all still-employed. Use `activeEmployeeWhere()` in every Prisma
 * query instead of copy-pasting `status: { notIn: [...] }`, so the definition lives in one place.
 */
import { EmployeeStatus } from "@prisma/client";

export const FORMER_EMPLOYEE_STATUSES: EmployeeStatus[] = [EmployeeStatus.RESIGNED, EmployeeStatus.FIRE];
export const ACTIVE_EMPLOYEE_STATUSES: EmployeeStatus[] = [EmployeeStatus.ACTIVE, EmployeeStatus.REJOINED, EmployeeStatus.PROBATION];

// QA test-fixture employees carry a "QA_"-prefixed code (QA_HR_, QA_SCOPE_, …). Real employee codes
// are never "QA_"-prefixed. This guard is a safety net so a QA fixture that leaked (e.g. a self-cleanup
// that failed) can never surface in a picker, report, or the probation-decisions dialog. Expressed as a
// NOT relation so rows with a null code are KEPT (a null is not "QA_"-prefixed).
// Bypass: the local QA harness sets QA_KEEP_TEST_EMPLOYEES=1 so a suite can still see the QA_ fixtures
// it creates. The flag is never set in production (or the dev server), so the net is always on there.
export const QA_TEST_CODE_PREFIX = "QA_";
export const excludeQaTestCodeWhere = () =>
  process.env.QA_KEEP_TEST_EMPLOYEES === "1" ? {} : { NOT: { code: { startsWith: QA_TEST_CODE_PREFIX } } };

/** True when a status value means the employee has left (resigned/fired). */
export const isFormerEmployee = (status?: string | null): boolean =>
  !!status && (FORMER_EMPLOYEE_STATUSES as string[]).includes(status);

/** A Prisma `where` that selects only current (non-deleted, non-former, non-QA) employees, plus any extra. */
export function activeEmployeeWhere<T extends Record<string, any>>(extra?: T): T & { isDeleted: null; status: { notIn: EmployeeStatus[] } } {
  return { isDeleted: null, status: { notIn: FORMER_EMPLOYEE_STATUSES }, ...excludeQaTestCodeWhere(), ...(extra as any) };
}

/** A Prisma relation filter (e.g. `unitEmployee.employee`) that excludes former + QA-fixture employees. */
export const activeEmployeeRelation = () => ({ isDeleted: null, status: { notIn: FORMER_EMPLOYEE_STATUSES }, ...excludeQaTestCodeWhere() });

/** SQL list of former statuses for raw queries, e.g. `e.status NOT IN (${FORMER_STATUS_SQL})`. */
export const FORMER_STATUS_SQL = FORMER_EMPLOYEE_STATUSES.map((s) => `'${s}'`).join(", ");
