/**
 * Calls to the face recognition service (Project 40 api.py) that the attendance scanner uses.
 * Register = POST /enroll/images (overwrite, previous set kept as a backup);
 * Test match = POST /get-employee, the same call the scanner makes, plus expect_employee_id so
 * the distance to this employee comes back even when another person wins.
 *   FACE_API_URL  default http://localhost:8000
 *   FACE_API_KEY  sent as X-API-Key (needed for enrol / restore)
 */
import { AppError } from "../../../../core/errors/app.error";

// Read the env at call time (not module load) so a test harness can point FACE_API_URL at a mock, and
// so a prod restart with --update-env is picked up without a rebuild.
const base = () => (process.env.FACE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const key = () => process.env.FACE_API_KEY || "";
const timeoutMs = () => Number(process.env.FACE_API_TIMEOUT_MS || 120000);

export type MatchResult = {
  status: "success" | "failed";
  employeeId: string | null;
  code: string | null;
  confidence: number | null;
  distance: number | null;
  expectedDistance: number | null;
  source: string | null;
  message?: string;
};

async function call(pathname: string, form: FormData, auth: boolean): Promise<any> {
  const BASE = base();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs());
  try {
    const res = await fetch(`${BASE}${pathname}`, {
      method: "POST",
      body: form,
      headers: auth && key() ? { "X-API-Key": key() } : undefined,
      signal: ctrl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.detail || data?.message || `Face service answered ${res.status}`;
      throw new AppError(res.status === 422 ? 422 : 502, `Face service: ${msg}`);
    }
    return data;
  } catch (e: any) {
    if (e instanceof AppError) throw e;
    const why = e?.name === "AbortError" ? "timed out" : "could not be reached";
    throw new AppError(502, `The face service ${why} (${BASE}).`);
  } finally {
    clearTimeout(timer);
  }
}

function jpegBlob(buf: Buffer): Blob {
  return new Blob([new Uint8Array(buf)], { type: "image/jpeg" });
}

export async function enrol(employee: { id: string; name: string; surname: string; code: string }, frames: { name: string; data: Buffer }[]): Promise<{ enrolled: number; skipped: string[] }> {
  const form = new FormData();
  form.append("employee_id", employee.id);
  form.append("name", employee.name || "");
  form.append("surname", employee.surname || "");
  form.append("code", employee.code || "");
  form.append("overwrite", "true");
  for (const f of frames) form.append("files", jpegBlob(f.data), f.name);
  const data = await call("/enroll/images", form, true);
  return { enrolled: Number(data?.enrolled || 0), skipped: Array.isArray(data?.skipped) ? data.skipped : [] };
}

/** Undo the last enrolment for this employee (previous set back, or none). */
export async function restore(employeeId: string): Promise<void> {
  await call(`/employees/${encodeURIComponent(employeeId)}/restore`, new FormData(), true);
}

export async function match(image: Buffer, expectEmployeeId: string): Promise<MatchResult> {
  const form = new FormData();
  form.append("file", jpegBlob(image), "holdout.jpg");
  form.append("expect_employee_id", expectEmployeeId);
  const d = await call("/get-employee", form, false);
  const emp = d?.employee || {};
  return {
    status: d?.status === "success" ? "success" : "failed",
    employeeId: (emp.employee_id ?? emp.id ?? null) as string | null,
    code: (emp.code ?? null) as string | null,
    confidence: typeof d?.confidence === "number" ? d.confidence : null,
    distance: typeof d?.distance === "number" ? d.distance : null,
    expectedDistance: typeof d?.expected_distance === "number" ? d.expected_distance : null,
    source: d?.source ?? null,
    message: d?.message,
  };
}

export const faceApiBase = base;
