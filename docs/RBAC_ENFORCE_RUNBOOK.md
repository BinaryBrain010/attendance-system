# RBAC_ENFORCE → `on` — production runbook

Flip the backend from permissive to enforcing (`requirePermission` starts returning **403** instead of
just logging). Everything here is **read-only until the grant step (§4) and the flip (§5)**. Do it in
this order; nothing before §4 changes prod.

Prereqs: prod runs the backend under **pm2**. **Confirm the app name first — the committed deploy notes
disagree** (the 2026-10-17 deploy log used `gatepass`, `PROD_DEPLOY_PLAN.md` uses `okasha-backend`), so
read it off the live process list and use that everywhere below:

```bash
pm2 list        # note the backend app's Name (the API process); the commands below write PM2_APP="<that name>"
```

This runbook writes the name as `$PM2_APP`; set it once: `PM2_APP="<name from pm2 list>"`. `.env` holds
`RBAC_ENFORCE` (absent = `off`). The committed `featureMap.json` is current —
`npm run qa:routes && npm run qa:featuremap` should report **0 unmapped**, and `npm run qa:selfowners`
should pass (every `self` route derives an owner). Best signal comes from first running prod in
`RBAC_ENFORCE=log` for ~1–2 weeks so `logs/rbac_denials.log` accumulates the real would-403 calls.

---

## 1. Export prod grants (read-only)

On the prod box (or any box pointed at the prod `DATABASE_URL`):

```bash
npx ts-node qa/exportRoleGrants.ts --allow-remote --out=$HOME/rbac/roleGrants-$(date +%F).json
```

SELECT-only. Writes **outside the repo** a JSON of every role/group: `allowedFeatures`, the groups that
grant each role, direct + effective user counts, and the effective `userIds` (used in §3 to attribute
denials to the exact role). Copy that file to wherever you'll run the preflight.

## 2. Grab the denial log (the "last 14 days" source)

If prod has been running `RBAC_ENFORCE=log`, copy its denial log:

```bash
cp /var/www/server/logs/rbac_denials.log $HOME/rbac/rbac_denials.log
```

Each line is `{ts,userId,route,reason,mode}` — exactly the routes real users hit that **would** 403.
If prod is currently `off`, first set `RBAC_ENFORCE=log` (§5 steps, value `log`), let it run, then come
back. No log yet → the preflight falls back to a nav-derived estimate (broader, still safe).

## 3. Run the preflight (read-only)

On your machine, with the two files from §1–§2:

```bash
npx ts-node qa/rbacPreflight.ts \
  --grants=$HOME/rbac/roleGrants-YYYY-MM-DD.json \
  --denials=$HOME/rbac/rbac_denials.log \
  --days=14
```

Writes `$HOME/rbac/RBAC_ENFORCE_PREFLIGHT_<date>.md` (outside the repo; pass `--out=` to change it):
per role → its users, the would-be-blocked routes they actually called in the window, and the single
**feature to grant** that clears each cluster. (Omit `--denials` to get the nav-derived view.)
`qa/enforcePreflight.ts --grants=… --out=$HOME/rbac/…` gives the same per-role gap table without the
call-history scoping if you want the full in-module list too.

## 4. Review the gaps, then grant the agreed ones

Decide, per role, which suggested features are legitimate (grant) vs routes the role should simply not
reach (leave 403). Put the agreed grants in a small JSON:

```json
{
  "Employee": ["crm.lead.read.own.*"],
  "Frontdesk": ["visitor.read.*"]
}
```

> Known gap from the Employee-role proof (`qa:emprole`): a **mentioned Employee** can't open a lead
> deep-link under enforce — `/lead/getById` is `crm.lead.read.own.*`. Grant that feature to **Employee**
> only if deep-linked lead participation must open for pure Employees. It is safe: an Employee has no
> `agentId`, so own-scope resolves to their own `createdById` — `/lead/get` then returns an **empty**
> list, no CRM leak; only leads they created or are a participant on open.

Apply it — **dry-run first** (changes nothing), then `--apply`:

```bash
# dry run — prints exactly what it would add, writes nothing
npx ts-node qa/applyRbacGrants.ts --grants=$HOME/rbac/grants.json --allow-remote
```

```bash
# write it (additive + idempotent: only ever ADDS features, re-running is a no-op)
npx ts-node qa/applyRbacGrants.ts --grants=$HOME/rbac/grants.json --apply --allow-remote
```

**Canonical alternative (version-controlled):** add the features to the role's recipe in
`roleRecipes.ts`, commit, and run the idempotent seeder:

```bash
npx ts-node seedRoles.ts --allow-remote
```

**SQL alternative** (per role — merges one feature into the role's FeaturePermission JSONB, idempotent):

```sql
UPDATE "FeaturePermission" fp
SET permissions = jsonb_set(
  permissions, '{allowedFeatures}',
  to_jsonb( ARRAY(SELECT DISTINCT e FROM unnest(
    ARRAY(SELECT jsonb_array_elements_text(fp.permissions->'allowedFeatures'))
    || ARRAY['crm.lead.read.own.*']            -- the feature to grant
  ) AS e) )
)
FROM "Role" r
WHERE fp."parentType" = 'Role' AND fp."parentId" = r.id
  AND r.name = 'Employee'                        -- the role
  AND fp."isDeleted" IS NULL;
```

Re-run §1 + §3 to confirm the gaps are closed (the preflight should now show ✅ for those roles).

## 5. Flip RBAC_ENFORCE to on

```bash
# in the backend .env on prod
sed -i 's/^RBAC_ENFORCE=.*/RBAC_ENFORCE=on/' .env || echo 'RBAC_ENFORCE=on' >> .env
pm2 restart "$PM2_APP" --update-env        # --update-env re-reads .env
pm2 logs "$PM2_APP" --lines 50             # confirm clean boot + "mode on"
```

## 6. Verify after the flip

- Watch `logs/rbac_denials.log` (now real 403s): any unexpected route → grant it (§4) or confirm it's
  intentionally blocked.
- Spot-check an Employee-role account: `/me` tabs load; employee list / reports / CRM lists are hidden.
  The `qa:emprole` suite proves this shape locally (20/0) and can be pointed at prod via `QA_BASE_URL`.

## 7. Rollback (one line)

Back to permissive logging immediately, no 403s, no data change:

```bash
sed -i 's/^RBAC_ENFORCE=on/RBAC_ENFORCE=log/' .env && pm2 restart "$PM2_APP" --update-env
```

(Use `RBAC_ENFORCE=off` to also stop the denial logging.)
