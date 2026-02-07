-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" VARCHAR(36) NOT NULL,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- Insert default row so GET/UPDATE work without explicit create
INSERT INTO "SystemConfig" ("id", "config", "updatedAt") VALUES ('default', '{}', NOW());
