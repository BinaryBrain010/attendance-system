DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftTimetableBlockType') THEN
    CREATE TYPE "ShiftTimetableBlockType" AS ENUM ('WORK', 'BREAK');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "ShiftTimetableBlock" (
  "id" VARCHAR(36) NOT NULL,
  "shiftId" VARCHAR(36) NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "type" "ShiftTimetableBlockType" NOT NULL DEFAULT 'WORK',
  "label" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  "isDeleted" TIMESTAMP(3),

  CONSTRAINT "ShiftTimetableBlock_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'ShiftTimetableBlock_shiftId_fkey'
  ) THEN
    ALTER TABLE "ShiftTimetableBlock"
    ADD CONSTRAINT "ShiftTimetableBlock_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "ShiftTimetableBlock_shiftId_dayOfWeek_idx" ON "ShiftTimetableBlock"("shiftId", "dayOfWeek");
