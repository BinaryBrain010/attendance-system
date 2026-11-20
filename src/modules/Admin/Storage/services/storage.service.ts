/**
 * Storage used per employee, counted on the server: image data kept in the database (base64 text
 * and JSON) and files on disk. Four parts:
 *   profilePhoto  Employee.image + imageThumb (database)
 *   documents     Employee.filePaths (disk)
 *   requestPhotos AttendanceRequest.image + LeaveRequest.image (database)
 *   faceCaptures  uploads/face-captures/<employeeId> (disk) + Employee.faceDescriptor (database)
 * The admin list is computed once and kept for a minute.
 */
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { AppError } from "../../../../core/errors/app.error";
import { ASSETS_DIR, UPLOADS_DIR } from "../../../../core/paths";
import { FACE_ROOT, dirBytes } from "../../../AMS/FaceCapture/helper/faceCaptureFiles";

export type StorageRow = {
  employeeId: string;
  code: string;
  name: string;
  status: string;
  profilePhoto: number;
  documents: number;
  documentCount: number;
  requestPhotos: number;
  faceCaptures: number;
  total: number;
};

type DbRow = { id: string; code: string; name: string; surname: string | null; status: string; filePaths: string[] | null; profile: bigint | number; descriptor: bigint | number; attreq: bigint | number; leavereq: bigint | number };

const CACHE_MS = 60_000;
let cache: { at: number; rows: StorageRow[] } | null = null;

function fileSize(rel: string): number {
  const full = path.resolve(ASSETS_DIR, rel);
  if (!full.startsWith(ASSETS_DIR)) return 0;
  try { return fs.statSync(full).size; } catch { return 0; }
}

async function dbRows(employeeId?: string): Promise<DbRow[]> {
  const where = employeeId ? Prisma.sql`WHERE e.id = ${employeeId}` : Prisma.sql`WHERE e."isDeleted" IS NULL`;
  return prisma.$queryRaw<DbRow[]>(Prisma.sql`
    SELECT e.id, e.code, e.name, e.surname, e.status::text AS status, e."filePaths",
           COALESCE(octet_length(e.image), 0) + COALESCE(octet_length(e."imageThumb"), 0) AS profile,
           COALESCE(octet_length(e."faceDescriptor"::text), 0) AS descriptor,
           COALESCE((SELECT SUM(octet_length(a.image)) FROM "AttendanceRequest" a WHERE a."employeeId" = e.id), 0) AS attreq,
           COALESCE((SELECT SUM(octet_length(l.image)) FROM "LeaveRequest" l WHERE l."employeeId" = e.id), 0) AS leavereq
    FROM "Employee" e ${where}`);
}

function toRow(r: DbRow): StorageRow {
  const paths = r.filePaths || [];
  const documents = paths.reduce((n, p) => n + fileSize(p), 0);
  const faceDisk = dirBytes(path.join(FACE_ROOT, r.id));
  const profilePhoto = Number(r.profile);
  const requestPhotos = Number(r.attreq) + Number(r.leavereq);
  const faceCaptures = faceDisk + Number(r.descriptor);
  return {
    employeeId: r.id,
    code: r.code,
    name: `${r.name} ${r.surname ?? ""}`.trim(),
    status: r.status,
    profilePhoto,
    documents,
    documentCount: paths.length,
    requestPhotos,
    faceCaptures,
    total: profilePhoto + documents + requestPhotos + faceCaptures,
  };
}

class StorageService {
  async employee(employeeId: string): Promise<StorageRow> {
    if (!employeeId || typeof employeeId !== "string") throw new AppError(400, "employeeId is required.");
    const rows = await dbRows(employeeId);
    if (!rows.length) throw new AppError(404, "Employee not found.");
    return toRow(rows[0]);
  }

  private async all(fresh = false): Promise<StorageRow[]> {
    if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
    const rows = (await dbRows()).map(toRow);
    cache = { at: Date.now(), rows };
    return rows;
  }

  async list(body: { search?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string; refresh?: boolean }) {
    const all = await this.all(!!body.refresh);
    const q = (body.search || "").trim().toLowerCase();
    const filtered = q ? all.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : all;
    const key = (["total", "profilePhoto", "documents", "requestPhotos", "faceCaptures", "code", "name"].includes(body.sortBy || "") ? body.sortBy : "total") as keyof StorageRow;
    const dir = body.sortOrder === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const x = a[key], y = b[key];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
    const page = Math.max(1, Number(body.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 25));
    const sum = (k: keyof StorageRow) => all.reduce((n, r) => n + (r[k] as number), 0);
    const [dbSize] = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT pg_database_size(current_database()) AS n`);
    return {
      data: sorted.slice((page - 1) * pageSize, page * pageSize),
      totalSize: filtered.length,
      page,
      pageSize,
      totals: {
        employees: all.length,
        profilePhoto: sum("profilePhoto"),
        documents: sum("documents"),
        requestPhotos: sum("requestPhotos"),
        faceCaptures: sum("faceCaptures"),
        total: sum("total"),
        databaseSize: Number(dbSize?.n ?? 0),
        uploadsFolder: dirBytes(UPLOADS_DIR),
      },
      computedAt: new Date(cache?.at ?? Date.now()),
    };
  }
}

export default StorageService;
