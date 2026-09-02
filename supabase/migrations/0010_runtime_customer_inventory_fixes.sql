-- RAFIKI OPERATIONS DESK — 0010_runtime_customer_inventory_fixes.sql
-- Forward fixes for deployments where 0009 has not yet been applied.
-- Apply after 0008 (and after the corrected 0009 when available).

-- System-generated audit events must be able to record without a human actor.
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Customer creation is an authenticated RPC and must not fail while writing
-- its audit record. Keep the signature compatible with 0007/0008.
CREATE OR REPLACE FUNCTION fn_create_customer(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT 'Harare',
  p_customer_type TEXT DEFAULT 'RESIDENTIAL',
  p_referral_source TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_number TEXT;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() NOT IN ('OWNER', 'SALES') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_first_name IS NULL OR trim(p_first_name) = '' THEN RAISE EXCEPTION 'FIRST_NAME_REQUIRED'; END IF;
  IF p_phone IS NULL OR trim(p_phone) = '' THEN RAISE EXCEPTION 'PHONE_REQUIRED'; END IF;
  v_number := fn_next_number('RTS-CUS-', 'seq_customer');
  INSERT INTO customers (id, customer_number, customer_type, first_name, last_name,
                         phone, email, address, city, referral_source, notes, status)
  VALUES (v_id, v_number, p_customer_type, trim(p_first_name), p_last_name,
          trim(p_phone), p_email, p_address, COALESCE(p_city, 'Harare'),
          p_referral_source, p_notes, 'ACTIVE');
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'CUSTOMER_CREATED', 'customers', v_id,
          jsonb_build_object('customer_number', v_number, 'name', p_first_name));
  RETURN jsonb_build_object('customer_id', v_id, 'customer_number', v_number);
END; $$;

REVOKE EXECUTE ON FUNCTION fn_create_customer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_create_customer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Safe retry protection for payment references. PostgreSQL requires a partial
-- unique index for this rule, not an ALTER TABLE partial constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_reference_unique
  ON payments (sale_id, payment_reference)
  WHERE payment_reference IS NOT NULL;

-- Ensure every seeded unit product has a dashboard row even when its physical
-- stock is still zero. This makes an empty warehouse visible and receivable.
INSERT INTO inventory (product_id, quantity_on_hand)
SELECT id, 0 FROM products
WHERE category = 'UNIT' AND active = true
ON CONFLICT (product_id) DO NOTHING;
