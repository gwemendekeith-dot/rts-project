# Apply Rafiki Operations Desk Migrations to a Fresh Supabase Project

Use this checklist to apply migrations `0001` through `0012` to a disposable Supabase project via the Supabase CLI. Do **not** edit existing migration files.

## Migration inventory

| # | File | Purpose |
|---|------|---------|
| 0001 | `0001_schema.sql` | Core schema: extensions, sequences, 24 tables, deferred FKs |
| 0002 | `0002_rls.sql` | Row-level security policies and role helpers |
| 0003 | `0003_functions.sql` | Core business-logic RPC functions |
| 0004 | `0004_views_seed.sql` | Dashboard views and seed data |
| 0005 | `0005_documents.sql` | `fn_issue_document` |
| 0006 | `0006_sale_and_dashboard.sql` | `fn_create_sale`, `v_dashboard` view |
| 0007 | `0007_customers_and_serial_ops.sql` | Customer creation and serial QC/status RPCs |
| 0008 | `0008_security_and_integrity.sql` | Auth guards, grants/revokes, serial validation trigger |
| 0009 | `0009_critical_remediation.sql` | Payment/QC/installation hardening, pg_cron sweep |
| 0010 | `0010_runtime_customer_inventory_fixes.sql` | Customer RPC auth fix, idempotent indexes |
| 0011 | `0011_document_storage.sql` | Storage bucket and `fn_link_document_file` |
| 0012 | `0012_sale_cancellation.sql` | `fn_cancel_sale`, refund rework |
| 0013 | `0013_qc_status_null_fix.sql` | Serial `qc_status` NOT NULL DEFAULT 'PENDING', null-safe checks |
| 0014 | `0014_audit_logs_nullable_user.sql` | Nullable `audit_logs.user_id` for system events with role constraint |
| 0015 | `0015_installer_required_for_schedule.sql` | Require `installer_id` before scheduling installation |
| 0016 | `0016_warranty_replacement_support.sql` | Partial unique index for ACTIVE warranties per serial and install |

**Sequence check:** files run from `0001` to `0016` with **no gaps**.

---

## Prerequisites

- [ ] [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`supabase --version`)
- [ ] Logged into Supabase (`supabase login`)
- [ ] A **disposable** Supabase project created in the [dashboard](https://supabase.com/dashboard) (free tier is fine)
- [ ] Project database is **empty** (new project) or you accept overwriting schema on push
- [ ] This repo checked out locally with `supabase/migrations/` present
- [ ] Optional for local disposable testing: [Docker Desktop](https://docs.docker.com/desktop/) running

---

## Option A — Remote disposable cloud project (recommended)

Run from the repository root (`rts-project/`).

### 1. Authenticate and link

- [ ] Log in (opens browser):

```bash
supabase login
```

- [ ] Copy the **Project ref** from **Project Settings → General** in the Supabase dashboard.

- [ ] Link the local project to the remote disposable project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

When prompted, enter the database password you set when creating the project.

### 2. Review pending migrations

- [ ] Confirm the CLI sees all 12 local migrations:

```bash
supabase migration list
```

Expected: local versions `0001` … `0012` show as not yet applied on remote.

### 3. Apply all migrations

- [ ] Push the full migration chain to the remote database:

```bash
supabase db push
```

Confirm when prompted. This applies `0001` through `0012` in filename order.

### 4. Verify

- [ ] Confirm remote shows all migrations applied:

```bash
supabase migration list
```

- [ ] Optional — inspect core objects in the linked DB:

```bash
supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;"
```

- [ ] Optional — confirm seed data from `0004`:

```bash
supabase db query --linked "SELECT sku, name FROM products WHERE category = 'UNIT' ORDER BY sku;"
```

Expected SKUs: `GH-12L`, `GH-16L`, `GH-20L`.

### 5. Run the lifecycle test script

- [ ] Open **SQL Editor** in the Supabase dashboard (runs as `postgres`, required for the test user bootstrap).
- [ ] Paste and run `test-scripts/full-lifecycle-test.sql`.
- [ ] Eyeball each step’s `result` column for `PASS`.

Alternatively, via the CLI against your linked remote project:

```bash
supabase db query --linked --file test-scripts/full-lifecycle-test.sql
```

---

## Option B — Local disposable stack (Docker)

Useful for offline iteration. Destroys and recreates the local DB on reset.

### 1. Start local Supabase

```bash
supabase start
```

Note the **DB URL** and **anon/service keys** printed in the output.

### 2. Reset and apply all migrations

```bash
supabase db reset
```

This drops the local database, reapplies migrations `0001`–`0012`, and runs `./seed.sql` if present (this repo has no `seed.sql`; seed data lives in `0004_views_seed.sql`).

### 3. Verify

```bash
supabase migration list
supabase db query --local "SELECT COUNT(*) AS migration_tables FROM information_schema.tables WHERE table_schema = 'public';"
```

### 4. Run lifecycle test

```bash
supabase db query --local --file test-scripts/full-lifecycle-test.sql
```

### 5. Tear down when finished

```bash
supabase stop
```

---

## Post-migration smoke checks (manual)

- [ ] `system_settings` has `warranty_default_months = 6` and `installer_fee = 50.00`
- [ ] Storage bucket `documents` exists (from `0011`):

```bash
supabase db query --linked "SELECT id, public FROM storage.buckets WHERE id = 'documents';"
```

- [ ] RPC functions are callable by `authenticated` (not `anon`):

```bash
supabase db query --linked "SELECT routine_name FROM information_schema.routine_privileges WHERE grantee = 'authenticated' AND routine_schema = 'public' AND routine_name LIKE 'fn_%' ORDER BY 1;"
```

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `relation "auth.users" does not exist` | Not a Supabase Postgres instance | Use Supabase-hosted DB or `supabase start` |
| `schema "storage" does not exist` | Migration `0011` on non-Supabase Postgres | Apply through Supabase; storage is platform-managed |
| `pg_cron` schedule fails | Extension unavailable on plan | Safe — `0009` catches the error and writes an audit note |
| `db push` wants to repair history | Remote already has divergent migrations | Use a fresh project or run `supabase db pull` only if you intend to reconcile |
| Test script `AUTHENTICATION_REQUIRED` | JWT claim not set | Run the full script from the top; do not skip the bootstrap block |

---

## Cleanup (disposable project)

When finished testing:

- [ ] Delete the disposable project in the Supabase dashboard (**Project Settings → General → Delete project**), or
- [ ] Unlink locally: `supabase unlink`

Never run destructive commands against production.
