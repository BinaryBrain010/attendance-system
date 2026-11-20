-- Face capture links + captures (additive only).
CREATE TABLE IF NOT EXISTS "FaceCaptureLink" (
    "id" VARCHAR(36) NOT NULL,
    "employeeId" VARCHAR(36) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "FaceCaptureLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FaceCaptureLink_tokenHash_key" ON "FaceCaptureLink"("tokenHash");
CREATE INDEX IF NOT EXISTS "FaceCaptureLink_employeeId_createdAt_idx" ON "FaceCaptureLink"("employeeId", "createdAt");

CREATE TABLE IF NOT EXISTS "FaceCapture" (
    "id" VARCHAR(36) NOT NULL,
    "employeeId" VARCHAR(36) NOT NULL,
    "linkId" VARCHAR(36),
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CAPTURED',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" TEXT,
    "files" JSONB,
    "registeredById" VARCHAR(36),
    "registeredAt" TIMESTAMP(3),
    "registerResult" JSONB,
    "verifiedById" VARCHAR(36),
    "verifiedAt" TIMESTAMP(3),
    "redoById" VARCHAR(36),
    "redoAt" TIMESTAMP(3),
    "redoReason" TEXT,
    "testResult" JSONB,
    "note" TEXT,
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" VARCHAR(36),
    "replacedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaceCapture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FaceCapture_employeeId_capturedAt_idx" ON "FaceCapture"("employeeId", "capturedAt");
CREATE INDEX IF NOT EXISTS "FaceCapture_status_idx" ON "FaceCapture"("status");
CREATE INDEX IF NOT EXISTS "FaceCapture_deleteAfter_idx" ON "FaceCapture"("deleteAfter");
