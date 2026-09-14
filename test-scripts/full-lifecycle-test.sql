-- ============================================================
-- RAFIKI OPERATIONS DESK — Full Lifecycle Integration Test
-- Run AFTER migrations 0001–0012 are applied.
--
-- Flow: bootstrap auth → receive 12L serial → create customer →
--       create sale → deposit payment → schedule install →
--       complete install → verify warranty ACTIVE → verify documents.
--
-- Run in Supabase SQL Editor (postgres role) or via Supabase CLI:
--   npx supabase db query --linked -f test-scripts/full-lifecycle-test.sql
--   (or --local if running against local Docker container)
--
-- Each step includes a comment with the expected result and a
-- SELECT that prints PASS/FAIL for manual eyeballing.
-- ============================================================

BEGIN;

-- ---------- Shared state for IDs returned by RPCs ----------
CREATE TEMP TABLE test_state (
  key   TEXT PRIMARY KEY,
  val   UUID,
  txt   TEXT,
  jsn   JSONB
);

-- ---------- Bootstrap: test operator with OWNER role ----------
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lifecycle-test@rafiki-ops.test',
    crypt('RafikiTest2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  INSERT INTO profiles (id, full_name, active_role, phone)
  VALUES (v_user_id, 'Lifecycle Test Operator', 'OWNER', '+263 77 123 4567');

  INSERT INTO user_roles (user_id, role, granted_by)
  VALUES (v_user_id, 'OWNER', v_user_id);

  INSERT INTO test_state (key, val) VALUES ('user_id', v_user_id);
END $$;

-- Simulate authenticated JWT for all RPC calls below (sets both legacy claim GUC and modern claims JSON)
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT val::text FROM test_state WHERE key = 'user_id'),
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', (SELECT val::text FROM test_state WHERE key = 'user_id'), 'role', 'authenticated')::text,
  true
);

-- ============================================================
-- STEP 0 — Resolve seeded catalogue references
-- Expected: one 12L product row, one active installer row
-- ============================================================
INSERT INTO test_state (key, val)
SELECT 'product_12l_id', id FROM products WHERE sku = 'GH-12L';

INSERT INTO test_state (key, val)
SELECT 'installer_id', id FROM installers WHERE installer_number = 'RTS-INS-001';

SELECT
  p.sku,
  p.name,
  p.requires_serial,
  p.requires_installation,
  p.selling_price,
  i.installer_number,
  CASE
    WHEN p.id IS NOT NULL AND i.id IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM products p, installers i
WHERE p.id = (SELECT val FROM test_state WHERE key = 'product_12l_id')
  AND i.id = (SELECT val FROM test_state WHERE key = 'installer_id');

-- ============================================================
-- STEP 1 — Receive one serialized 12L unit into stock
-- Expected: fn_receive_stock returns {"count": 1} equivalent;
--           serial GH-12L-901 exists with status AVAILABLE, qc_status PENDING
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
  v_count := fn_receive_stock(
    (SELECT val FROM test_state WHERE key = 'product_12l_id'),
    ARRAY['GH-12L-901'],
    CURRENT_DATE
  );
  INSERT INTO test_state (key, txt) VALUES ('receive_count', v_count::text);
END $$;

INSERT INTO test_state (key, val)
SELECT 'serial_id', id
FROM serial_numbers
WHERE serial_number = 'GH-12L-901';

SELECT
  serial_number,
  status,
  qc_status,
  (SELECT txt FROM test_state WHERE key = 'receive_count') AS units_received,
  CASE
    WHEN status = 'AVAILABLE'
     AND qc_status = 'PENDING'
     AND (SELECT txt FROM test_state WHERE key = 'receive_count') = '1'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM serial_numbers
WHERE id = (SELECT val FROM test_state WHERE key = 'serial_id');

-- ============================================================
-- STEP 2 — Pass receiving QC (required before sale per 0008/0009)
-- Expected: serial qc_status becomes PASS
-- ============================================================
DO $$
BEGIN
  PERFORM fn_set_serial_qc(
    (SELECT val FROM test_state WHERE key = 'serial_id'),
    'PASS',
    'receiving-photo/gh-12l-901.jpg'
  );
END $$;

SELECT
  serial_number,
  qc_status,
  receiving_photo_ref,
  CASE WHEN qc_status = 'PASS' THEN 'PASS' ELSE 'FAIL' END AS result
FROM serial_numbers
WHERE id = (SELECT val FROM test_state WHERE key = 'serial_id');

-- ============================================================
-- STEP 3 — Create customer
-- Expected: JSON with customer_id + RTS-CUS-YYYY-#### number;
--           customers.status = ACTIVE
-- ============================================================
DO $$
DECLARE v_result JSONB;
BEGIN
  v_result := fn_create_customer(
    p_first_name      := 'Tendai',
    p_phone           := '+263 77 555 0101',
    p_last_name       := 'Moyo',
    p_email           := 'tendai.moyo@example.com',
    p_address         := '14 Samora Machel Avenue, Avondale',
    p_city            := 'Harare',
    p_customer_type   := 'RESIDENTIAL',
    p_referral_source := 'WALK_IN',
    p_notes           := 'Lifecycle test customer — safe to delete'
  );
  INSERT INTO test_state (key, val, jsn) VALUES (
    'customer_id',
    (v_result->>'customer_id')::uuid,
    v_result
  );
END $$;

SELECT
  customer_number,
  first_name,
  last_name,
  phone,
  status,
  CASE WHEN status = 'ACTIVE' THEN 'PASS' ELSE 'FAIL' END AS result
FROM customers
WHERE id = (SELECT val FROM test_state WHERE key = 'customer_id');

-- ============================================================
-- STEP 4 — Create sale with serialized 12L unit ($150.00)
-- Expected: sale UNPAID, fulfilment PENDING, one sale_item linked to serial
-- ============================================================
DO $$
DECLARE v_result JSONB;
BEGIN
  v_result := fn_create_sale(
    p_customer_id := (SELECT val FROM test_state WHERE key = 'customer_id'),
    p_notes       := 'Lifecycle test — 12L unit sale',
    p_items       := jsonb_build_array(
      jsonb_build_object(
        'product_id',       (SELECT val FROM test_state WHERE key = 'product_12l_id'),
        'quantity',         1,
        'serial_number_id', (SELECT val FROM test_state WHERE key = 'serial_id')
      )
    )
  );
  INSERT INTO test_state (key, val, jsn) VALUES (
    'sale_id',
    (v_result->>'sale_id')::uuid,
    v_result
  );
END $$;

SELECT
  s.sale_number,
  s.total_amount,
  s.payment_status,
  s.fulfilment_status,
  si.serial_number_id,
  sn.serial_number,
  sn.status AS serial_status_at_sale,
  CASE
    WHEN s.payment_status = 'UNPAID'
     AND s.fulfilment_status = 'PENDING'
     AND s.total_amount = 150.00
     AND si.serial_number_id = (SELECT val FROM test_state WHERE key = 'serial_id')
     AND sn.status = 'AVAILABLE'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
JOIN serial_numbers sn ON sn.id = si.serial_number_id
WHERE s.id = (SELECT val FROM test_state WHERE key = 'sale_id');

-- ============================================================
-- STEP 5 — Issue invoice document
-- Expected: one INVOICE row, status ISSUED, linked to sale
-- ============================================================
DO $$
DECLARE v_doc documents%ROWTYPE;
BEGIN
  v_doc := fn_issue_document(
    p_type        := 'INVOICE',
    p_customer_id := (SELECT val FROM test_state WHERE key = 'customer_id'),
    p_sale_id     := (SELECT val FROM test_state WHERE key = 'sale_id'),
    p_template_version := 'v1.0'
  );
  INSERT INTO test_state (key, val) VALUES ('invoice_doc_id', v_doc.id);
END $$;

SELECT
  document_number,
  document_type,
  status,
  sale_id,
  CASE
    WHEN document_type = 'INVOICE'
     AND status = 'ISSUED'
     AND sale_id = (SELECT val FROM test_state WHERE key = 'sale_id')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM documents
WHERE id = (SELECT val FROM test_state WHERE key = 'invoice_doc_id');

-- ============================================================
-- STEP 6 — Record $75 deposit (partial payment on $150 sale)
-- Expected: payment_status PARTIAL; serial RESERVED; install job + PENDING warranty created
-- ============================================================
DO $$
DECLARE v_result JSONB;
BEGIN
  v_result := fn_record_payment(
    p_sale_id   := (SELECT val FROM test_state WHERE key = 'sale_id'),
    p_amount    := 75.00,
    p_method    := 'CASH',
    p_reference := 'TEST-DEP-20260904-001'
  );
  INSERT INTO test_state (key, jsn) VALUES ('payment_result', v_result);
  INSERT INTO test_state (key, val)
  SELECT 'payment_id', id
  FROM payments
  WHERE payment_number = v_result->>'payment_number';
END $$;

INSERT INTO test_state (key, val)
SELECT 'installation_id', id
FROM installations
WHERE sale_id = (SELECT val FROM test_state WHERE key = 'sale_id')
ORDER BY created_at DESC
LIMIT 1;

INSERT INTO test_state (key, val)
SELECT 'warranty_id', id
FROM warranties
WHERE sale_id = (SELECT val FROM test_state WHERE key = 'sale_id')
ORDER BY created_at DESC
LIMIT 1;

SELECT
  s.payment_status,
  s.amount_paid,
  s.balance_due,
  s.fulfilment_status,
  sn.status AS serial_status,
  i.job_number,
  i.status AS install_status,
  w.warranty_number,
  w.status AS warranty_status,
  CASE
    WHEN s.payment_status = 'PARTIAL'
     AND s.amount_paid = 75.00
     AND s.balance_due = 75.00
     AND sn.status = 'RESERVED'
     AND i.status = 'PENDING'
     AND w.status = 'PENDING'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM sales s
JOIN serial_numbers sn ON sn.id = (SELECT val FROM test_state WHERE key = 'serial_id')
JOIN installations i ON i.id = (SELECT val FROM test_state WHERE key = 'installation_id')
JOIN warranties w ON w.id = (SELECT val FROM test_state WHERE key = 'warranty_id')
WHERE s.id = (SELECT val FROM test_state WHERE key = 'sale_id');

-- ============================================================
-- STEP 7 — Issue receipt document for the deposit
-- Expected: one RECEIPT row linked to payment_id
-- ============================================================
DO $$
DECLARE v_doc documents%ROWTYPE;
BEGIN
  v_doc := fn_issue_document(
    p_type        := 'RECEIPT',
    p_customer_id := (SELECT val FROM test_state WHERE key = 'customer_id'),
    p_payment_id  := (SELECT val FROM test_state WHERE key = 'payment_id'),
    p_template_version := 'v1.0'
  );
  INSERT INTO test_state (key, val) VALUES ('receipt_doc_id', v_doc.id);
END $$;

SELECT
  document_number,
  document_type,
  status,
  payment_id,
  CASE
    WHEN document_type = 'RECEIPT'
     AND status = 'ISSUED'
     AND payment_id = (SELECT val FROM test_state WHERE key = 'payment_id')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM documents
WHERE id = (SELECT val FROM test_state WHERE key = 'receipt_doc_id');

-- ============================================================
-- STEP 8 — Schedule installation
-- Expected: install status SCHEDULED; serial ALLOCATED; sale fulfilment SCHEDULED
-- ============================================================
DO $$
DECLARE v_result JSONB;
BEGIN
  v_result := fn_schedule_installation(
    p_job_id       := (SELECT val FROM test_state WHERE key = 'installation_id'),
    p_date         := CURRENT_DATE + 3,
    p_installer_id := (SELECT val FROM test_state WHERE key = 'installer_id')
  );
  INSERT INTO test_state (key, jsn) VALUES ('schedule_result', v_result);
END $$;

SELECT
  i.status AS install_status,
  i.scheduled_date,
  i.installer_id,
  sn.status AS serial_status,
  s.fulfilment_status,
  CASE
    WHEN i.status = 'SCHEDULED'
     AND sn.status = 'ALLOCATED'
     AND s.fulfilment_status = 'SCHEDULED'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM installations i
JOIN serial_numbers sn ON sn.id = i.serial_number_id
JOIN sales s ON s.id = i.sale_id
WHERE i.id = (SELECT val FROM test_state WHERE key = 'installation_id');

-- ============================================================
-- STEP 9 — Complete installation (activates warranty)
-- Expected: install COMPLETED; serial INSTALLED; warranty ACTIVE with dates;
--           sale fulfilment INSTALLED
-- ============================================================
DO $$
DECLARE v_result JSONB;
BEGIN
  v_result := fn_complete_installation(
    p_job_id            := (SELECT val FROM test_state WHERE key = 'installation_id'),
    p_gas_test          := true,
    p_water_test        := true,
    p_unit_test         := true,
    p_customer_handover := true,
    p_signature_ref     := 'signatures/tendai-moyo-20260904.png',
    p_photo_refs        := ARRAY['photos/install-001.jpg', 'photos/install-002.jpg'],
    p_installer_notes   := 'All tests passed. Customer briefed on operation.'
  );
  INSERT INTO test_state (key, jsn) VALUES ('complete_result', v_result);
END $$;

SELECT
  i.status AS install_status,
  i.gas_test,
  i.water_test,
  i.unit_test,
  i.customer_handover,
  sn.status AS serial_status,
  w.status AS warranty_status,
  w.start_date,
  w.expiry_date,
  s.fulfilment_status,
  CASE
    WHEN i.status = 'COMPLETED'
     AND sn.status = 'INSTALLED'
     AND w.status = 'ACTIVE'
     AND w.start_date = CURRENT_DATE
     AND w.expiry_date = (CURRENT_DATE + INTERVAL '6 months')::date
     AND s.fulfilment_status = 'INSTALLED'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM installations i
JOIN serial_numbers sn ON sn.id = i.serial_number_id
JOIN warranties w ON w.installation_id = i.id
JOIN sales s ON s.id = i.sale_id
WHERE i.id = (SELECT val FROM test_state WHERE key = 'installation_id');

-- ============================================================
-- STEP 10 — Issue installation report and warranty certificate
-- Expected: two additional document rows (INSTALLATION_REPORT, WARRANTY_CERTIFICATE)
-- ============================================================
DO $$
DECLARE v_ins_doc documents%ROWTYPE;
DECLARE v_wty_doc documents%ROWTYPE;
BEGIN
  v_ins_doc := fn_issue_document(
    p_type            := 'INSTALLATION_REPORT',
    p_customer_id     := (SELECT val FROM test_state WHERE key = 'customer_id'),
    p_installation_id := (SELECT val FROM test_state WHERE key = 'installation_id'),
    p_template_version := 'v1.0'
  );
  INSERT INTO test_state (key, val) VALUES ('install_report_doc_id', v_ins_doc.id);

  v_wty_doc := fn_issue_document(
    p_type            := 'WARRANTY_CERTIFICATE',
    p_customer_id     := (SELECT val FROM test_state WHERE key = 'customer_id'),
    p_warranty_id     := (SELECT val FROM test_state WHERE key = 'warranty_id'),
    p_template_version := 'v1.0'
  );
  INSERT INTO test_state (key, val) VALUES ('warranty_doc_id', v_wty_doc.id);
END $$;

SELECT
  document_type,
  document_number,
  status,
  CASE document_type
    WHEN 'INSTALLATION_REPORT'  THEN installation_id IS NOT NULL
    WHEN 'WARRANTY_CERTIFICATE' THEN warranty_id IS NOT NULL
    ELSE true
  END AS linkage_ok,
  CASE
    WHEN document_type IN ('INSTALLATION_REPORT', 'WARRANTY_CERTIFICATE')
     AND status = 'ISSUED'
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM documents
WHERE id IN (
  (SELECT val FROM test_state WHERE key = 'install_report_doc_id'),
  (SELECT val FROM test_state WHERE key = 'warranty_doc_id')
)
ORDER BY document_type;

-- ============================================================
-- STEP 11 — Final warranty confirmation
-- Expected: exactly one ACTIVE warranty for this sale/serial
-- ============================================================
SELECT
  w.warranty_number,
  w.status,
  w.start_date,
  w.expiry_date,
  w.duration_months,
  sn.serial_number,
  c.customer_number,
  CASE
    WHEN w.status = 'ACTIVE'
     AND w.serial_number_id = (SELECT val FROM test_state WHERE key = 'serial_id')
     AND w.customer_id = (SELECT val FROM test_state WHERE key = 'customer_id')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM warranties w
JOIN serial_numbers sn ON sn.id = w.serial_number_id
JOIN customers c ON c.id = w.customer_id
WHERE w.sale_id = (SELECT val FROM test_state WHERE key = 'sale_id');

-- ============================================================
-- STEP 12 — Final document inventory for this customer
-- Expected: 4 ISSUED documents (INVOICE, RECEIPT, INSTALLATION_REPORT, WARRANTY_CERTIFICATE)
-- ============================================================
SELECT
  document_type,
  document_number,
  status,
  template_version,
  CASE WHEN status = 'ISSUED' THEN 'PASS' ELSE 'FAIL' END AS result
FROM documents
WHERE customer_id = (SELECT val FROM test_state WHERE key = 'customer_id')
ORDER BY document_type;

SELECT
  COUNT(*) AS document_count,
  COUNT(*) FILTER (WHERE status = 'ISSUED') AS issued_count,
  CASE
    WHEN COUNT(*) = 4
     AND COUNT(*) FILTER (WHERE document_type = 'INVOICE') = 1
     AND COUNT(*) FILTER (WHERE document_type = 'RECEIPT') = 1
     AND COUNT(*) FILTER (WHERE document_type = 'INSTALLATION_REPORT') = 1
     AND COUNT(*) FILTER (WHERE document_type = 'WARRANTY_CERTIFICATE') = 1
     AND COUNT(*) FILTER (WHERE status = 'ISSUED') = 4
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM documents
WHERE customer_id = (SELECT val FROM test_state WHERE key = 'customer_id');

-- Uncomment COMMIT to persist test data; ROLLBACK removes everything.
ROLLBACK;
-- COMMIT;
