/**
 * Single source of truth for "former" vs "active" employees. A former employee is one who has left —
 * resigned or fired/terminated (the only exit statuses in the EmployeeStatus enum: RESIGNED, FIRE).
 * ACTIVE, REJOINED and PROBATION are all still-employed. Use `activeEmployeeWhere()` in every Prisma
 * query instead of copy-pasting `status: { notIn: [...] }`, so the definition lives in one place.
 */
import { EmployeeStatus } from "@prisma/client";

export const FORMER_EMPLOYEE_STATUSES: EmployeeStatus[] = [EmployeeStatus.RESIGNED, EmployeeStatus.FIRE];
export const ACTIVE_EMPLOYEE_STATUSES: EmployeeStatus[] = [EmployeeStatus.ACTIVE, EmployeeStatus.REJOINED, EmployeeStatus.PROBATION];

/** True when a status value means the employee has left (resigned/fired). */
export const isFormerEmployee = (status?: string | null): boolean =>
  !!status && (FORMER_EMPLOYEE_STATUSES as string[]).includes(status);

/** A Prisma `where` that selects only current (non-deleted, non-former) employees, plus any extra. */
export function activeEmployeeWhere<T extends Record<string, any>>(extra?: T): T & { isDeleted: null; status: { notIn: EmployeeStatus[] } } {
  return { isDeleted: null, status: { notIn: FORMER_EMPLOYEE_STATUSES }, ...(extra as any) };
}

/** A Prisma relation filter (e.g. `unitEmployee.employee`) that excludes former employees. */
export const activeEmployeeRelation = () => ({ isDeleted: null, status: { notIn: FORMER_EMPLOYEE_STATUSES } });

/** SQL list of former statuses for raw queries, e.g. `e.status NOT IN (${FORMER_STATUS_SQL})`. */
export const FORMER_STATUS_SQL = FORMER_EMPLOYEE_STATUSES.map((s) => `'${s}'`).join(", ");
