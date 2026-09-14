-- ============================================================
-- RAFIKI OPERATIONS DESK — 0014_audit_logs_nullable_user.sql
-- Allow system/cron/migration events to record in audit_logs
-- without an authenticated user_id actor.
-- ============================================================

-- Step 1: Ensure audit_logs.user_id is nullable for system-generated events
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add check constraint ensuring user_id is only NULL for unauthenticated system events.
-- In 0002_rls.sql, fn_set_audit_actor_role() defaults actor_role to current_user_role().
-- When auth.uid() is NULL (system/cron context), current_user_role() returns NULL.
-- The schema's valid roles are ('OWNER','SALES','OPERATIONS'); there is no 'SYSTEM' role.
-- Therefore, an event without a user_id must have actor_role IS NULL.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_logs_user_or_system;
ALTER TABLE audit_logs ADD CONSTRAINT chk_audit_logs_user_or_system
  CHECK (user_id IS NOT NULL OR actor_role IS NULL);

COMMENT ON COLUMN audit_logs.user_id IS
  'UUID of the acting user from auth.users. May be NULL only for automated system events (e.g. pg_cron sweeps, schema migrations) where actor_role is NULL.';
