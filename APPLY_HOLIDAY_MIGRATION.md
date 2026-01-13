# How to Apply the Holiday Migration Safely

## Overview
This migration adds the `Holiday` table to your database. It is **completely safe** and will **NOT**:
- Delete any existing tables
- Modify any existing tables
- Delete any existing data
- Alter any existing columns

The migration only **creates a new table** called `Holiday`.

## Migration Details

**Migration Name:** `20260114022147_add_holiday_model`

**What it does:**
- Creates the `Holiday` table with all required fields
- Creates indexes on `date` and `isDeleted` columns for better query performance
- Uses `IF NOT EXISTS` clauses to prevent errors if run multiple times

## Step-by-Step Instructions

### Option 1: Apply Migration Using Prisma (Recommended)

1. **Check Migration Status:**
   ```bash
   npx prisma migrate status
   ```

2. **Apply the Migration:**
   ```bash
   npx prisma migrate deploy
   ```
   
   This will apply all pending migrations including the Holiday migration.

3. **Verify the Migration:**
   ```bash
   npx prisma migrate status
   ```
   
   You should see that the migration is now applied.

4. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

### Option 2: Apply Migration Manually (If Prisma Migrate Fails)

If for some reason Prisma migrate doesn't work, you can apply the SQL directly:

1. **Connect to your PostgreSQL database** using your preferred tool (pgAdmin, psql, etc.)

2. **Run the SQL from the migration file:**
   ```sql
   -- Copy and paste the contents of:
   -- prisma/migrations/20260114022147_add_holiday_model/migration.sql
   ```

3. **Verify the table was created:**
   ```sql
   SELECT * FROM "Holiday" LIMIT 1;
   ```

4. **Mark the migration as applied:**
   ```bash
   npx prisma migrate resolve --applied 20260114022147_add_holiday_model
   ```

5. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

## Safety Features

The migration includes several safety features:

1. **IF NOT EXISTS**: The table creation uses `CREATE TABLE IF NOT EXISTS`, so running it multiple times won't cause errors.

2. **Index Creation**: Indexes use `CREATE INDEX IF NOT EXISTS` to prevent duplicate index errors.

3. **No DROP Statements**: The migration contains NO `DROP TABLE`, `DROP COLUMN`, or `ALTER TABLE` statements that could affect existing data.

4. **Isolated Operation**: The migration only creates a new table and doesn't reference or modify any existing tables.

## Verification

After applying the migration, verify it worked correctly:

1. **Check if the table exists:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'Holiday';
   ```

2. **Check the table structure:**
   ```sql
   \d "Holiday"
   ```
   (In psql) or use your database tool to view the table structure.

3. **Verify indexes:**
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'Holiday';
   ```

## Rollback (If Needed)

If you need to rollback this migration:

1. **Drop the table:**
   ```sql
   DROP TABLE IF EXISTS "Holiday";
   ```

2. **Mark migration as rolled back:**
   ```bash
   npx prisma migrate resolve --rolled-back 20260114022147_add_holiday_model
   ```

**Note:** Rolling back will delete all holiday data. Make sure to backup data if needed.

## Troubleshooting

### Error: "relation 'Holiday' already exists"
- This means the table already exists. The migration is safe to skip.
- Mark it as applied: `npx prisma migrate resolve --applied 20260114022147_add_holiday_model`

### Error: "permission denied"
- Make sure your database user has CREATE TABLE permissions.
- Contact your database administrator if needed.

### Error: "migration already applied"
- The migration has already been applied. No action needed.
- Run `npx prisma generate` to update the Prisma client.

## Next Steps

After successfully applying the migration:

1. ✅ Run `npx prisma generate` to update the Prisma client
2. ✅ Restart your application server
3. ✅ Test the holiday endpoints using the API documentation
4. ✅ Verify the holiday management features work correctly

## Support

If you encounter any issues:
1. Check the Prisma migration logs
2. Verify database connection settings in `.env`
3. Ensure you have the latest Prisma CLI: `npm install -g prisma`
4. Review the migration SQL file for any syntax errors

---

**Migration Created:** 2026-01-14  
**Safe for Production:** Yes  
**Requires Downtime:** No  
**Data Loss Risk:** None
