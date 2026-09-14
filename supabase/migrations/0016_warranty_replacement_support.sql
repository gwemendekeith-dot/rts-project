-- ============================================================
-- RAFIKI OPERATIONS DESK — 0016_warranty_replacement_support.sql
-- Allow multiple warranty rows per serial number and per installation,
-- enforcing that at most ONE warranty may be ACTIVE at any given time.
-- ============================================================

-- Step 1: Drop unconditional table-level UNIQUE constraints
-- In 0001_schema.sql, serial_number_id and installation_id were defined inline as UNIQUE,
-- generating constraints warranties_serial_number_id_key and warranties_installation_id_key.
ALTER TABLE warranties
  DROP CONSTRAINT IF EXISTS warranties_serial_number_id_key,
  DROP CONSTRAINT IF EXISTS warranties_installation_id_key;

-- Step 2: Add partial unique index for serial_number_id (only one ACTIVE warranty per serial)
-- Allowed values of warranties.status per 0001_schema.sql:
-- ('PENDING','ACTIVE','EXPIRED','VOID','CLAIMED','CLOSED')
CREATE UNIQUE INDEX IF NOT EXISTS uq_warranty_active_per_serial
  ON warranties(serial_number_id)
  WHERE status = 'ACTIVE';

-- Step 3: Add partial unique index for installation_id (only one ACTIVE warranty per installation)
CREATE UNIQUE INDEX IF NOT EXISTS uq_warranty_active_per_installation
  ON warranties(installation_id)
  WHERE status = 'ACTIVE';

COMMENT ON INDEX uq_warranty_active_per_serial IS
  'Guarantees at most one ACTIVE warranty per serial number; historical/replacement warranties (VOID, EXPIRED, CLAIMED, CLOSED, PENDING) may coexist.';

COMMENT ON INDEX uq_warranty_active_per_installation IS
  'Guarantees at most one ACTIVE warranty per installation job.';
