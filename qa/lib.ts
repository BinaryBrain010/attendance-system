/**
 * Shared QA harness library: local-only guard, god-token mint, HTTP helpers, result recorder.
 * Talks to the REAL local API over HTTP. Node 20+ global fetch is used.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

dotenv.config();

// ---------- HARD RULE: local only ----------
const DB = process.env.DATABASE_URL || "";
const host = (() => {
  try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; }
})();
export const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(host);
if (!IS_LOCAL) {
  console.error(`[QA] REFUSING TO RUN — DATABASE_URL host is "${host}", not localhost. Aborting.`);
  process.exit(2);
}

export const BASE = process.env.QA_BASE_URL || "http://localhost:3002";
export const QA_PASSWORD = "QaPass!2026";
export const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
export const QA_TAG = "QA_";
export const QA_EMAIL_DOMAIN = "@test.local";

export function mintGodToken(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set in .env");
  return jwt.sign({ userId: GOD_ID, unitIds: [] }, secret, { expiresIn: "3h" });
}

export function mintTokenFor(userId: string, unitIds: string[] = []): string {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ userId, unitIds }, secret, { expiresIn: "3h" });
}

export interface HttpResult { status: number; ok: boolean; json: any; text?: string }

export async function http(
  method: string, pathname: string,
  opts: { token?: string; body?: any } = {}
): Promise<HttpResult> {
  const headers: any = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(BASE + pathname, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e: any) {
    return { status: 0, ok: false, json: null, text: String(e?.message || e) };
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Login (raw, non-enveloped response). */
export async function login(username: string, password: string, platform: string, rememberMe = false) {
  // NOTE: rememberMe MUST be sent — the backend crashes (LoggedInUsers.rememberMe required, no default)
  // if it is omitted. See QA finding BUG: login-without-rememberMe.
  const r = await http("POST", "/auth/login", { body: { username, password, platform, rememberMe } });
  return {
    status: r.status,
    token: r.json?.token as string | undefined,
    permissions: (r.json?.permissions as string[] | undefined) || undefined,
    unitIds: (r.json?.unitIds as string[] | undefined) || undefined,
    message: r.json?.message as string | undefined,
  };
}

/** Enveloped call: returns {status, data, message, raw}. */
export async function api(method: string, pathname: string, token: string | undefined, body?: any) {
  const r = await http(method, pathname, { token, body });
  return { status: r.status, data: r.json?.data, message: r.json?.message, raw: r.json, text: r.text };
}

// ---------- result recorder ----------
export const results: {
  personas: any[];
  featureCatalog: any[];
  endpoints: any[];
  matrix: any[];
  permChanges: any[];
  multiUser: any[];
  ui: any[];
  bugs: any[];
  gaps: any[];
  meta: any;
} = {
  personas: [], featureCatalog: [], endpoints: [], matrix: [],
  permChanges: [], multiUser: [], ui: [], bugs: [], gaps: [], meta: {},
};

let TID = 0;
export function testId(prefix = "T") { return `${prefix}${String(++TID).padStart(4, "0")}`; }

export function recordMatrix(row: {
  module: string; persona: string; scenario: string; steps: string;
  expected: string; actual: string; status: number | string; result: "Pass" | "Fail" | "Blocked"; notes?: string;
}) {
  results.matrix.push({ id: testId(), ...row, notes: row.notes || "" });
}

export function bug(sev: "Critical" | "High" | "Medium" | "Low", module: string, description: string, repro: string, fix: string, files = "") {
  results.bugs.push({ id: `BUG${String(results.bugs.length + 1).padStart(3, "0")}`, severity: sev, module, description, repro, fix, files });
}

export function gap(kind: string, detail: string, impact: string) {
  results.gaps.push({ id: `GAP${String(results.gaps.length + 1).padStart(3, "0")}`, kind, detail, impact });
}

export function saveResults() {
  const dir = path.join(__dirname);
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`[QA] results.json written (${results.matrix.length} matrix rows, ${results.bugs.length} bugs, ${results.gaps.length} gaps)`);
}

export function loadResults() {
  const p = path.join(__dirname, "results.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
