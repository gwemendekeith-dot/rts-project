-- Rafiki disposable-project lifecycle smoke test.
-- Run after all migrations have been applied, as the database owner/postgres role.
-- This script creates one test OWNER context and leaves the test records in place.

BEGIN;

-- Prerequisite: create a disposable authenticated OWNER so SECURITY DEFINER RPCs
-- can resolve auth.uid() and current_user_role(). Expected result: one test user,
-- profile, and OWNER role are present.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'rafiki.lifecycle@example.test', crypt('RafikiTest-2026!', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, active_role, phone)
VALUES ('11111111-1111-1111-1111-111111111111', 'Lifecycle Test Owner', 'OWNER', '+263 71 000 0000')
ON CONFLICT (id) DO UPDATE SET active_role = 'OWNER';

INSERT INTO public.user_roles (user_id, role, granted_by)
VALUES ('11111111-1111-1111-1111-111111111111', 'OWNER', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (user_id, role) DO NOTHING;

-- Make auth.uid() return the disposable test user for all RPC calls below.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

CREATE TEMP TABLE lifecycle_context (
  customer_id UUID,
  product_id UUID,
  serial_id UUID,
  sale_id UUID,
  payment_id UUID,
  job_id UUID,
  warranty_id UUID
) ON COMMIT DROP;
INSERT INTO lifecycle_context DEFAULT VALUES;

-- Step 1: create customer. Expected result: fn_create_customer returns a customer_id
-- and an RTS-CUS-... number, and one ACTIVE customer row is created.
WITH created AS (
  SELECT fn_create_customer(
    'Tendai', '+263 77 123 4567', 'Moyo', 'tendai.moyo@example.test',
    '12 Borrowdale Road', 'Harare', 'RESIDENTIAL', 'WHATSAPP',
    'Disposable lifecycle smoke test customer'
  ) AS payload
)
UPDATE lifecycle_context
SET customer_id = (created.payload->>'customer_id')::UUID
FROM created;
SELECT customer_id, c.customer_number, c.status
FROM lifecycle_context ctx JOIN customers c ON c.id = ctx.customer_id;

-- Step 2: locate the seeded serialized 12L product. Expected result: exactly one
-- active product with SKU GH-12L and requires_serial = true.
UPDATE lifecycle_context
SET product_id = (SELECT id FROM products WHERE sku = 'GH-12L' AND active AND requires_serial);
SELECT product_id, sku, selling_price, requires_serial
FROM lifecycle_context ctx JOIN products p ON p.id = ctx.product_id;

-- Step 3: receive one serialized unit. Expected result: fn_receive_stock returns 1,
-- and serial GH-12L-001 is AVAILABLE with QC status PENDING.
SELECT fn_receive_stock(
  (SELECT product_id FROM lifecycle_context),
  ARRAY['GH-12L-001']::TEXT[],
  CURRENT_DATE
) AS received_serial_count;
UPDATE lifecycle_context
SET serial_id = (SELECT id FROM serial_numbers WHERE serial_number = 'GH-12L-001');
SELECT serial_number, status, qc_status
FROM lifecycle_context ctx JOIN serial_numbers s ON s.id = ctx.serial_id;

-- Step 4: pass receiving QC. Expected result: the serial becomes QC PASS and is
-- eligible for sale selection and first-payment reservation.
SELECT fn_set_serial_qc(
  (SELECT serial_id FROM lifecycle_context), 'PASS', 'test-scan://GH-12L-001'
) AS qc_result;
SELECT serial_number, status, qc_status
FROM lifecycle_context ctx JOIN serial_numbers s ON s.id = ctx.serial_id;

-- Step 5: create a sale for the serialized 12L unit. Expected result: an UNPAID sale
-- is created at the server-configured GH-12L price ($150 in the seed data).
WITH created AS (
  SELECT fn_create_sale(
    (SELECT customer_id FROM lifecycle_context), NULL, 'WHATSAPP', false,
    'Disposable lifecycle smoke test sale',
    jsonb_build_array(jsonb_build_object(
      'product_id', (SELECT product_id FROM lifecycle_context),
      'quantity', 1,
      'serial_number_id', (SELECT serial_id FROM lifecycle_context)
    ))
  ) AS payload
)
UPDATE lifecycle_context
SET sale_id = (created.payload->>'sale_id')::UUID
FROM created;
SELECT sale_number, total_amount, payment_status, fulfilment_status
FROM lifecycle_context ctx JOIN sales s ON s.id = ctx.sale_id;

-- Step 6: record a deposit payment. Expected result: a CONFIRMED $75 CASH payment,
-- sale status PARTIAL, serial RESERVED, and one pending installation job/warranty.
SELECT fn_record_payment(
  (SELECT sale_id FROM lifecycle_context), 75.00, 'CASH', 'LIFECYCLE-DEP-001'
) AS payment_result;
UPDATE lifecycle_context
SET payment_id = (
  SELECT id FROM payments
  WHERE sale_id = (SELECT sale_id FROM lifecycle_context)
    AND payment_reference = 'LIFECYCLE-DEP-001'
);
UPDATE lifecycle_context
SET job_id = (SELECT id FROM installations WHERE sale_id = lifecycle_context.sale_id);
UPDATE lifecycle_context
SET warranty_id = (SELECT id FROM warranties WHERE installation_id = lifecycle_context.job_id);
SELECT s.sale_number, s.amount_paid, s.balance_due, s.payment_status,
       p.payment_number, p.status AS payment_row_status,
       sn.serial_number, sn.status AS serial_status,
       i.job_number, i.status AS installation_status,
       w.warranty_number, w.status AS warranty_status
FROM lifecycle_context ctx
JOIN sales s ON s.id = ctx.sale_id
JOIN payments p ON p.id = ctx.payment_id
JOIN serial_numbers sn ON sn.id = ctx.serial_id
JOIN installations i ON i.id = ctx.job_id
JOIN warranties w ON w.id = ctx.warranty_id;

-- Step 7: schedule the installation. Expected result: the job is SCHEDULED, the
-- serial is ALLOCATED, and the sale fulfilment status becomes SCHEDULED.
SELECT fn_schedule_installation(
  (SELECT job_id FROM lifecycle_context),
  CURRENT_DATE + 7,
  (SELECT id FROM installers WHERE status = 'ACTIVE' ORDER BY created_at LIMIT 1)
) AS schedule_result;
SELECT i.job_number, i.scheduled_date, i.status, sn.serial_number, sn.status AS serial_status,
       s.fulfilment_status
FROM lifecycle_context ctx
JOIN installations i ON i.id = ctx.job_id
JOIN serial_numbers sn ON sn.id = ctx.serial_id
JOIN sales s ON s.id = ctx.sale_id;

-- Step 8: complete installation with every required checklist item and a signature.
-- Expected result: job COMPLETED, serial INSTALLED, and warranty ACTIVE with a
-- server-computed six-month expiry date.
SELECT fn_complete_installation(
  (SELECT job_id FROM lifecycle_context), true, true, true, true,
  'test-signature://tendai-moyo',
  ARRAY['test-photo://geyser-front.jpg']::TEXT[],
  'All disposable lifecycle checks passed.'
) AS completion_result;
SELECT i.job_number, i.status AS installation_status,
       sn.serial_number, sn.status AS serial_status,
       w.warranty_number, w.status AS warranty_status, w.start_date, w.expiry_date
FROM lifecycle_context ctx
JOIN installations i ON i.id = ctx.job_id
JOIN serial_numbers sn ON sn.id = ctx.serial_id
JOIN warranties w ON w.id = ctx.warranty_id;

-- Step 9: issue the lifecycle documents. Expected result: one issued INVOICE,
-- RECEIPT, WARRANTY_CERTIFICATE, and INSTALLATION_REPORT row linked to this data.
SELECT (fn_issue_document('INVOICE', (SELECT customer_id FROM lifecycle_context),
                          (SELECT sale_id FROM lifecycle_context))).document_number AS invoice_number;
SELECT (fn_issue_document('RECEIPT', (SELECT customer_id FROM lifecycle_context),
                          (SELECT sale_id FROM lifecycle_context),
                          (SELECT payment_id FROM lifecycle_context))).document_number AS receipt_number;
SELECT (fn_issue_document('WARRANTY_CERTIFICATE', (SELECT customer_id FROM lifecycle_context),
                          (SELECT sale_id FROM lifecycle_context), NULL, NULL,
                          (SELECT job_id FROM lifecycle_context),
                          (SELECT warranty_id FROM lifecycle_context))).document_number AS warranty_number;
SELECT (fn_issue_document('INSTALLATION_REPORT', (SELECT customer_id FROM lifecycle_context),
                          (SELECT sale_id FROM lifecycle_context), NULL, NULL,
                          (SELECT job_id FROM lifecycle_context))).document_number AS installation_report_number;

-- Step 10: final assertions. Expected result: every assertion returns PASS and the
-- document count is 4; any failed invariant raises an error and rolls back the test.
DO $$
DECLARE
  ctx lifecycle_context%ROWTYPE;
  v_docs INT;
BEGIN
  SELECT * INTO ctx FROM lifecycle_context LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM warranties WHERE id = ctx.warranty_id AND status = 'ACTIVE')
    THEN RAISE EXCEPTION 'FAIL: warranty is not ACTIVE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM serial_numbers WHERE id = ctx.serial_id AND status = 'INSTALLED')
    THEN RAISE EXCEPTION 'FAIL: serial is not INSTALLED'; END IF;
  SELECT COUNT(*) INTO v_docs FROM documents
   WHERE sale_id = ctx.sale_id AND status = 'ISSUED';
  IF v_docs <> 4 THEN RAISE EXCEPTION 'FAIL: expected 4 issued documents, found %', v_docs; END IF;
  RAISE NOTICE 'PASS: full customer -> sale -> deposit -> installation -> warranty -> documents lifecycle';
END $$;

COMMIT;
