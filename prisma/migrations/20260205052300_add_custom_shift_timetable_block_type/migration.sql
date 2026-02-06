DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftTimetableBlockType') THEN
    CREATE TYPE "ShiftTimetableBlockType" AS ENUM ('WORK', 'BREAK');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ShiftTimetableBlockType' AND e.enumlabel = 'CUSTOM'
  ) THEN
    ALTER TYPE "ShiftTimetableBlockType" ADD VALUE 'CUSTOM';
  END IF;
END$$;

ALTER TABLE IF EXISTS "ShiftTimetableBlock"
  ADD COLUMN IF NOT EXISTS "customType" TEXT;
