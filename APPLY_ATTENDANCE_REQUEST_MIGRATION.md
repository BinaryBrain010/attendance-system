# Apply Attendance Request Migration Guide

## Overview
This migration safely adds new columns to the `AttendanceRequest` table to support the attendance request approval system. The migration is **non-destructive** and will not affect any existing data.

## Migration Details

**Migration File:** `prisma/migrations/20260115000000_update_attendance_request/migration.sql`

**What it does:**
- Adds `attendanceId` column (nullable) - Links to attendance record being updated
- Adds proposed change fields (all nullable):
  - `proposedStatus`
  - `proposedCheckIn`
  - `proposedCheckOut`
  - `proposedComment`
  - `proposedLocation`
  - `proposedDate`
- Adds user tracking fields (nullable):
  - `requestedBy` - User who created the request
  - `approvedBy` - User who approved/rejected the request

**Safety Features:**
- All columns are nullable - existing records remain valid
- Uses `ADD COLUMN IF NOT EXISTS` for idempotency
- No existing columns are modified or deleted
- No existing data is affected

---

## How to Apply

### Option 1: Using Prisma Migrate (Recommended)

If you're using Prisma's migration system:

```bash
cd "d:\Development\Projects\Project 6 (Solar Max)\Server\Backend"
npx prisma migrate deploy
npx prisma generate
```

### Option 2: Manual SQL Application

If you need to apply the migration manually:

1. **Open your database client** (e.g., pgAdmin, DBeaver, psql)

2. **Run the migration SQL:**
   ```sql
   -- Add attendanceId column
   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "attendanceId" VARCHAR(36);

   -- Add proposed attendance change fields
   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "proposedStatus" VARCHAR(255);

   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "proposedCheckIn" TIMESTAMP(3);

   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "proposedCheckOut" TIMESTAMP(3);

   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "proposedComment" TEXT;

   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "proposedLocation" VARCHAR(255);

   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "proposedDate" TIMESTAMP(3);

   -- Add user tracking fields
   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "requestedBy" VARCHAR(36);

   ALTER TABLE "AttendanceRequest" 
   ADD COLUMN IF NOT EXISTS "approvedBy" VARCHAR(36);
   ```

3. **Mark migration as applied** (if using Prisma):
   ```bash
   npx prisma migrate resolve --applied 20260115000000_update_attendance_request
   ```

4. **Regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```

---

## Verification

After applying the migration, verify it was successful:

### 1. Check Table Structure

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'AttendanceRequest'
ORDER BY ordinal_position;
```

You should see the new columns:
- `attendanceId`
- `proposedStatus`
- `proposedCheckIn`
- `proposedCheckOut`
- `proposedComment`
- `proposedLocation`
- `proposedDate`
- `requestedBy`
- `approvedBy`

### 2. Check Existing Data

```sql
SELECT COUNT(*) as total_requests
FROM "AttendanceRequest"
WHERE "isDeleted" IS NULL;
```

All existing records should still be accessible and valid.

### 3. Test API Endpoints

After regenerating Prisma client, test the endpoints:

```bash
# Get all attendance requests (should include employee details)
GET /attendanceReq/get

# Get paginated requests
POST /attendanceReq/get
{
  "page": 1,
  "pageSize": 10
}
```

---

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the new columns
ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "approvedBy";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "requestedBy";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "proposedDate";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "proposedLocation";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "proposedComment";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "proposedCheckOut";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "proposedCheckIn";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "proposedStatus";

ALTER TABLE "AttendanceRequest" 
DROP COLUMN IF EXISTS "attendanceId";
```

**Note:** Rolling back will only remove the new columns. Existing data in other columns remains intact.

---

## Troubleshooting

### Error: Column already exists

If you see an error that a column already exists:
- The migration uses `IF NOT EXISTS`, so this shouldn't happen
- If it does, the column may have been added manually
- You can safely skip that column or remove `IF NOT EXISTS` from the migration

### Error: Cannot find module after migration

After applying the migration, always run:
```bash
npx prisma generate
```

This regenerates the Prisma client with the new schema fields.

### Existing Records Show NULL for New Fields

This is **expected behavior**. New columns are nullable, and existing records will have NULL values for these fields until they are updated through the new system.

---

## Post-Migration Steps

1. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Restart Your Application:**
   - Restart the Node.js/Express server
   - Clear any cached Prisma clients

3. **Verify Functionality:**
   - Test creating an attendance request
   - Test updating attendance (should create request if no permission)
   - Test approving/rejecting requests
   - Verify employee details are included in responses

4. **Update Feature Permissions:**
   - Assign `attendance.update.direct.*` to administrators
   - Assign `attendance.request.approve.*` to authorized approvers

---

**Version:** 1.0  
**Last Updated:** 2026-01-15
