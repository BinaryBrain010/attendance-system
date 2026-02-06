CREATE TABLE "Holiday" (
    "id" VARCHAR(36) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdBy" VARCHAR(36),
    "updatedBy" VARCHAR(36),
    "previousUpdates" JSONB,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);
