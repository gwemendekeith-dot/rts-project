-- ============================================================
-- RAFIKI OPERATIONS DESK — Full lifecycle integration test
-- Run against a fresh database with migrations 0001–0012 applied.
--
-- Prerequisites:
--   • All migrations applied (supabase db push or supabase db reset)
--   • Run in the Supabase SQL Editor or psql connected as postgres
--
-- This script bootstraps a test auth user, executes the business
-- RPCs in order, and prints pass/fail checks after each step.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 0: Bootstrap authenticated test actor (OWNER role)
-- EXPECTED: One row in auth.users, profiles, and user_roles;
--           auth.uid() resolves to the test user UUID below.
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'lifecycle-test@rafiki.local',
    crypt('test-password-123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, full_name, active_role, phone)
  VALUES (v_user_id, 'Lifecycle Test Owner', 'OWNER', '+263770000001')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        active_role = EXCLUDED.active_role;

  INSERT INTO user_roles (user_id, role, granted_by)
  VALUES
    (v_user_id, 'OWNER', v_user_id),
    (v_user_id, 'SALES', v_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

-- EXPECTED: pass = true, actual_user_id = aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
SELECT
  auth.uid() IS NOT NULL AS pass,
  auth.uid() AS actual_user_id,
  current_user_role() AS active_role;

-- Shared context for the remaining steps
CREATE TEMP TABLE _lifecycle_ctx (
  key   TEXT PRIMARY KEY,
  value UUID
);

-- ============================================================
-- STEP 1: Receive a 12L serial into stock
-- EXPECTED: fn_receive_stock returns 1; serial status AVAILABLE,
--           qc_status PENDING; format matches GH-12L-### pattern.
-- ============================================================
DO $$
DECLARE
  v_product_id UUID;
  v_received   INT;
  v_serial_id  UUID;
BEGIN
  SELECT id INTO v_product_id FROM products WHERE sku = 'GH-12L';

  v_received := fn_receive_stock(
    v_product_id,
    ARRAY['GH-12L-042'],
    CURRENT_DATE
  );

  IF v_received <> 1 THEN
    RAISE EXCEPTION 'STEP 1 FAIL: expected fn_receive_stock to insert 1 serial, got %', v_received;
  END IF;

  SELECT id INTO v_serial_id
  FROM serial_numbers
  WHERE serial_number = 'GH-12L-042';

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('product_12l', v_product_id),
    ('serial_id', v_serial_id);
END $$;

-- EXPECTED: pass = true, status = AVAILABLE, qc_status = PENDING
SELECT
  sn.serial_number IS NOT NULL AS pass,
  sn.serial_number,
  sn.status,
  sn.qc_status
FROM serial_numbers sn
WHERE sn.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id');

-- ============================================================
-- STEP 2: QC pass the serial (required before sale from 0008+)
-- EXPECTED: fn_set_serial_qc returns qc_status = PASS.
-- ============================================================
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := fn_set_serial_qc(
    (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id'),
    'PASS',
    'receiving/2026-09-04/GH-12L-042.jpg'
  );

  IF (v_result->>'qc_status') <> 'PASS' THEN
    RAISE EXCEPTION 'STEP 2 FAIL: expected QC PASS, got %', v_result;
  END IF;
END $$;

-- EXPECTED: pass = true, qc_status = PASS
SELECT
  sn.qc_status = 'PASS' AS pass,
  sn.qc_status,
  sn.receiving_photo_ref
FROM serial_numbers sn
WHERE sn.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id');

-- ============================================================
-- STEP 3: Create customer
-- EXPECTED: fn_create_customer returns customer_id and a numbered
--           RTS-CUS-YYYY-#### customer_number; status ACTIVE.
-- ============================================================
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := fn_create_customer(
    p_first_name      => 'Tendai',
    p_phone           => '+263771234567',
    p_last_name       => 'Moyo',
    p_email           => 'tendai.moyo@example.com',
    p_address         => '14 Samora Machel Avenue, Avondale',
    p_city            => 'Harare',
    p_customer_type   => 'RESIDENTIAL',
    p_referral_source => 'WALK_IN',
    p_notes           => 'Lifecycle test customer — disposable DB only'
  );

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('customer_id', (v_result->>'customer_id')::uuid);
END $$;

-- EXPECTED: pass = true, status = ACTIVE, customer_number like RTS-CUS-2026-####
SELECT
  c.status = 'ACTIVE'
  AND c.customer_number ~ '^RTS-CUS-[0-9]{4}-[0-9]{4}$' AS pass,
  c.customer_number,
  c.first_name,
  c.last_name,
  c.phone,
  c.status
FROM customers c
WHERE c.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id');

-- ============================================================
-- STEP 4: Create sale with serialized 12L unit
-- EXPECTED: sale total_amount = 150.00 (GH-12L selling_price),
--           payment_status UNPAID, fulfilment_status PENDING,
--           sale_items row links the serial.
-- ============================================================
DO $$
DECLARE
  v_result JSONB;
  v_items  JSONB;
BEGIN
  v_items := jsonb_build_array(
    jsonb_build_object(
      'product_id', (SELECT value FROM _lifecycle_ctx WHERE key = 'product_12l'),
      'quantity', 1,
      'serial_number_id', (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id')
    )
  );

  v_result := fn_create_sale(
    p_customer_id => (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id'),
    p_notes       => 'Lifecycle test sale — 12L gas geyser',
    p_items       => v_items
  );

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('sale_id', (v_result->>'sale_id')::uuid);
END $$;

-- EXPECTED: pass = true, total_amount = 150.00, payment_status = UNPAID
SELECT
  s.total_amount = 150.00
  AND s.payment_status = 'UNPAID'
  AND s.fulfilment_status = 'PENDING' AS pass,
  s.sale_number,
  s.total_amount,
  s.amount_paid,
  s.balance_due,
  s.payment_status,
  s.fulfilment_status
FROM sales s
WHERE s.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id');

-- EXPECTED: pass = true, serial still AVAILABLE until first payment
SELECT
  si.serial_number_id IS NOT NULL AS pass,
  sn.status AS serial_status,
  sn.qc_status
FROM sale_items si
JOIN serial_numbers sn ON sn.id = si.serial_number_id
WHERE si.sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id');

-- ============================================================
-- STEP 5: Issue invoice document for the sale
-- EXPECTED: one INVOICE row, status ISSUED, linked to sale + customer.
-- ============================================================
DO $$
DECLARE
  v_doc documents%ROWTYPE;
BEGIN
  v_doc := fn_issue_document(
    p_type             => 'INVOICE',
    p_customer_id      => (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id'),
    p_sale_id          => (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id'),
    p_template_version => 'v1.0'
  );

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('invoice_document_id', v_doc.id);
END $$;

-- EXPECTED: pass = true, document_type = INVOICE, status = ISSUED
SELECT
  d.document_type = 'INVOICE'
  AND d.status = 'ISSUED'
  AND d.sale_id IS NOT NULL AS pass,
  d.document_number,
  d.document_type,
  d.status
FROM documents d
WHERE d.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'invoice_document_id');

-- ============================================================
-- STEP 6: Record deposit payment ($75 on $150 sale)
-- EXPECTED: payment_status PARTIAL, balance_due 75.00,
--           serial RESERVED, installation job + PENDING warranty created.
-- ============================================================
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := fn_record_payment(
    p_sale_id   => (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id'),
    p_amount    => 75.00,
    p_method    => 'CASH',
    p_reference => 'LIFECYCLE-DEP-001'
  );

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('payment_id', (
      SELECT id FROM payments
      WHERE sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id')
      ORDER BY payment_date DESC
      LIMIT 1
    )),
    ('installation_id', (
      SELECT id FROM installations
      WHERE sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id')
      LIMIT 1
    )),
    ('warranty_id', (
      SELECT w.id
      FROM warranties w
      JOIN installations i ON i.id = w.installation_id
      WHERE i.sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id')
      LIMIT 1
    ));
END $$;

-- EXPECTED: pass = true, payment_status = PARTIAL, balance_due = 75.00
SELECT
  s.payment_status = 'PARTIAL'
  AND s.amount_paid = 75.00
  AND s.balance_due = 75.00 AS pass,
  s.payment_status,
  s.amount_paid,
  s.balance_due
FROM sales s
WHERE s.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id');

-- EXPECTED: pass = true, serial status = RESERVED, linked to sale
SELECT
  sn.status = 'RESERVED'
  AND sn.sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id') AS pass,
  sn.status,
  sn.sold_date
FROM serial_numbers sn
WHERE sn.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id');

-- EXPECTED: pass = true, installation status = PENDING, warranty status = PENDING
SELECT
  i.status = 'PENDING'
  AND w.status = 'PENDING' AS pass,
  i.job_number,
  i.status AS installation_status,
  w.warranty_number,
  w.status AS warranty_status
FROM installations i
JOIN warranties w ON w.installation_id = i.id
WHERE i.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id');

-- ============================================================
-- STEP 7: Issue receipt document for the deposit payment
-- EXPECTED: one RECEIPT row linked to payment_id + sale_id.
-- ============================================================
DO $$
DECLARE
  v_doc documents%ROWTYPE;
BEGIN
  v_doc := fn_issue_document(
    p_type             => 'RECEIPT',
    p_customer_id      => (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id'),
    p_sale_id          => (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id'),
    p_payment_id       => (SELECT value FROM _lifecycle_ctx WHERE key = 'payment_id'),
    p_template_version => 'v1.0'
  );

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('receipt_document_id', v_doc.id);
END $$;

-- EXPECTED: pass = true, document_type = RECEIPT, payment_id populated
SELECT
  d.document_type = 'RECEIPT'
  AND d.payment_id IS NOT NULL AS pass,
  d.document_number,
  d.document_type
FROM documents d
WHERE d.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'receipt_document_id');

-- ============================================================
-- STEP 8: Schedule installation
-- EXPECTED: installation status SCHEDULED, serial ALLOCATED,
--           sale fulfilment_status SCHEDULED.
-- ============================================================
DO $$
DECLARE
  v_installer_id UUID;
  v_result       JSONB;
BEGIN
  SELECT id INTO v_installer_id
  FROM installers
  WHERE installer_number = 'RTS-INS-001';

  v_result := fn_schedule_installation(
    p_job_id       => (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id'),
    p_date         => CURRENT_DATE + 3,
    p_installer_id => v_installer_id
  );

  IF (v_result->>'scheduled_date') IS NULL THEN
    RAISE EXCEPTION 'STEP 8 FAIL: schedule returned %', v_result;
  END IF;
END $$;

-- EXPECTED: pass = true, installation = SCHEDULED, sale = SCHEDULED
SELECT
  i.status = 'SCHEDULED'
  AND s.fulfilment_status = 'SCHEDULED' AS pass,
  i.status AS installation_status,
  i.scheduled_date,
  s.fulfilment_status AS sale_fulfilment_status
FROM installations i
JOIN sales s ON s.id = i.sale_id
WHERE i.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id');

-- EXPECTED: pass = true, serial status = ALLOCATED
SELECT
  sn.status = 'ALLOCATED' AS pass,
  sn.status
FROM serial_numbers sn
WHERE sn.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id');

-- ============================================================
-- STEP 9: Complete installation (activates warranty)
-- EXPECTED: installation COMPLETED, serial INSTALLED,
--           warranty ACTIVE with start/expiry dates,
--           sale fulfilment_status INSTALLED.
-- ============================================================
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := fn_complete_installation(
    p_job_id            => (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id'),
    p_gas_test          => true,
    p_water_test        => true,
    p_unit_test         => true,
    p_customer_handover => true,
    p_signature_ref     => 'signatures/2026-09-04/tendai-moyo.png',
    p_photo_refs        => ARRAY['install/2026-09-04/unit-front.jpg', 'install/2026-09-04/gas-test.jpg'],
    p_installer_notes   => 'All tests passed. Customer briefed on operation.'
  );

  IF (v_result->>'warranty_number') IS NULL THEN
    RAISE EXCEPTION 'STEP 9 FAIL: complete installation returned %', v_result;
  END IF;
END $$;

-- EXPECTED: pass = true, installation status = COMPLETED
SELECT
  i.status = 'COMPLETED'
  AND i.gas_test = true
  AND i.water_test = true
  AND i.unit_test = true
  AND i.customer_handover = true AS pass,
  i.status,
  i.completed_at IS NOT NULL AS has_completed_at
FROM installations i
WHERE i.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id');

-- EXPECTED: pass = true, serial status = INSTALLED
SELECT
  sn.status = 'INSTALLED'
  AND sn.installed_date = CURRENT_DATE AS pass,
  sn.status,
  sn.installed_date
FROM serial_numbers sn
WHERE sn.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'serial_id');

-- ============================================================
-- STEP 10: Confirm warranty is ACTIVE
-- EXPECTED: warranty status ACTIVE, start_date = today,
--           expiry_date ~ 6 months out (from system_settings).
-- ============================================================
SELECT
  w.status = 'ACTIVE'
  AND w.start_date = CURRENT_DATE
  AND w.expiry_date = (CURRENT_DATE + make_interval(months => 6))::date AS pass,
  w.warranty_number,
  w.status,
  w.start_date,
  w.expiry_date,
  w.terms_version
FROM warranties w
WHERE w.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'warranty_id');

-- EXPECTED: pass = true, sale fulfilment_status = INSTALLED
SELECT
  s.fulfilment_status = 'INSTALLED' AS pass,
  s.fulfilment_status,
  s.payment_status
FROM sales s
WHERE s.id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id');

-- ============================================================
-- STEP 11: Issue post-installation documents
-- EXPECTED: WARRANTY_CERTIFICATE and INSTALLATION_REPORT rows created.
-- ============================================================
DO $$
DECLARE
  v_wty_doc documents%ROWTYPE;
  v_ins_doc documents%ROWTYPE;
BEGIN
  v_wty_doc := fn_issue_document(
    p_type             => 'WARRANTY_CERTIFICATE',
    p_customer_id      => (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id'),
    p_sale_id          => (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id'),
    p_warranty_id      => (SELECT value FROM _lifecycle_ctx WHERE key = 'warranty_id'),
    p_template_version => 'v1.0'
  );

  v_ins_doc := fn_issue_document(
    p_type             => 'INSTALLATION_REPORT',
    p_customer_id      => (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id'),
    p_sale_id          => (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id'),
    p_installation_id  => (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id'),
    p_template_version => 'v1.0'
  );

  INSERT INTO _lifecycle_ctx (key, value) VALUES
    ('warranty_document_id', v_wty_doc.id),
    ('install_report_document_id', v_ins_doc.id);
END $$;

-- ============================================================
-- STEP 12: Confirm all expected document rows exist
-- EXPECTED: 4 documents for this sale — INVOICE, RECEIPT,
--           WARRANTY_CERTIFICATE, INSTALLATION_REPORT — all ISSUED.
-- ============================================================
SELECT
  COUNT(*) = 4 AS pass,
  COUNT(*) AS document_count,
  COUNT(*) FILTER (WHERE document_type = 'INVOICE') AS invoices,
  COUNT(*) FILTER (WHERE document_type = 'RECEIPT') AS receipts,
  COUNT(*) FILTER (WHERE document_type = 'WARRANTY_CERTIFICATE') AS warranty_certs,
  COUNT(*) FILTER (WHERE document_type = 'INSTALLATION_REPORT') AS install_reports,
  COUNT(*) FILTER (WHERE status = 'ISSUED') AS issued_count
FROM documents
WHERE sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id');

-- EXPECTED: pass = true for every row; all four types present and ISSUED
SELECT
  d.document_type,
  d.document_number,
  d.status,
  d.status = 'ISSUED' AS pass,
  CASE d.document_type
    WHEN 'INVOICE'               THEN d.sale_id IS NOT NULL
    WHEN 'RECEIPT'               THEN d.payment_id IS NOT NULL
    WHEN 'WARRANTY_CERTIFICATE'  THEN d.warranty_id IS NOT NULL
    WHEN 'INSTALLATION_REPORT'   THEN d.installation_id IS NOT NULL
    ELSE true
  END AS linkage_ok
FROM documents d
WHERE d.sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id')
ORDER BY d.document_type;

-- ============================================================
-- FINAL SUMMARY
-- EXPECTED: all counts = 1; all pass flags true when read as a set.
-- ============================================================
SELECT
  'customer' AS entity,
  EXISTS (SELECT 1 FROM customers WHERE id = (SELECT value FROM _lifecycle_ctx WHERE key = 'customer_id')) AS pass
UNION ALL
SELECT 'sale', EXISTS (SELECT 1 FROM sales WHERE id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id'))
UNION ALL
SELECT 'payment', EXISTS (SELECT 1 FROM payments WHERE id = (SELECT value FROM _lifecycle_ctx WHERE key = 'payment_id'))
UNION ALL
SELECT 'installation', EXISTS (SELECT 1 FROM installations WHERE id = (SELECT value FROM _lifecycle_ctx WHERE key = 'installation_id'))
UNION ALL
SELECT 'warranty_active', EXISTS (
  SELECT 1 FROM warranties
  WHERE id = (SELECT value FROM _lifecycle_ctx WHERE key = 'warranty_id')
    AND status = 'ACTIVE'
)
UNION ALL
SELECT 'documents_complete', (
  SELECT COUNT(*) = 4
  FROM documents
  WHERE sale_id = (SELECT value FROM _lifecycle_ctx WHERE key = 'sale_id')
    AND status = 'ISSUED'
);

-- Uncomment the next line to discard test data after review:
-- ROLLBACK;

COMMIT;
