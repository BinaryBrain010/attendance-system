-- CreateTable
CREATE TABLE IF NOT EXISTS "ShiftTimetable" (
    "id" VARCHAR(36) NOT NULL,
    "shiftId" VARCHAR(36) NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),

    CONSTRAINT "ShiftTimetable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'ShiftTimetable_shiftId_fkey'
  ) THEN
    ALTER TABLE "ShiftTimetable"
    ADD CONSTRAINT "ShiftTimetable_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShiftTimetable_shiftId_dayOfWeek_key" ON "ShiftTimetable"("shiftId", "dayOfWeek");
