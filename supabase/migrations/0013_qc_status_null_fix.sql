-- ============================================================
-- RAFIKI OPERATIONS DESK — 0013_qc_status_null_fix.sql
-- Enforce NOT NULL on serial_numbers.qc_status with 'PENDING' default
-- and replace raw <> comparisons with null-safe distinct checks.
-- ============================================================

-- Step 1: Backfill any legacy NULL qc_status values to 'PENDING'
UPDATE serial_numbers
   SET qc_status = 'PENDING'
 WHERE qc_status IS NULL;

-- Step 2: Set default and enforce NOT NULL on serial_numbers.qc_status
ALTER TABLE serial_numbers
  ALTER COLUMN qc_status SET DEFAULT 'PENDING',
  ALTER COLUMN qc_status SET NOT NULL;

-- Step 3: Re-create fn_create_sale with null-safe QC check
CREATE OR REPLACE FUNCTION fn_create_sale(
  p_customer_id UUID,
  p_referral_partner_id UUID DEFAULT NULL,
  p_referral_source TEXT DEFAULT NULL,
  p_is_preorder BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id UUID := gen_random_uuid();
  v_sale_no TEXT;
  v_item JSONB;
  v_product products%ROWTYPE;
  v_subtotal NUMERIC := 0;
  v_quantity INT;
  v_serial_id UUID;
  v_serial_qc TEXT;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() NOT IN ('OWNER', 'SALES') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'NO_ITEMS'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := COALESCE((v_item->>'quantity')::INT, 0);
    IF v_quantity <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
    IF COALESCE((v_item->>'discount')::NUMERIC, 0) <> 0 THEN
      RAISE EXCEPTION 'DISCOUNT_REQUIRES_APPROVAL';
    END IF;
    v_serial_id := NULLIF(v_item->>'serial_number_id', '')::UUID;
    IF v_product.requires_serial AND NOT p_is_preorder THEN
      IF v_serial_id IS NULL THEN RAISE EXCEPTION 'SERIAL_REQUIRED'; END IF;
      -- CRITICAL: Verify serial exists, is available, and QC status is PASS
      SELECT qc_status INTO v_serial_qc FROM serial_numbers
        WHERE id = v_serial_id AND product_id = v_product.id AND status = 'AVAILABLE';
      IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_UNAVAILABLE'; END IF;
      -- Null-safe check: NULL or any non-PASS status raises SERIAL_QC_FAILED
      IF v_serial_qc IS NULL OR v_serial_qc <> 'PASS' THEN
        RAISE EXCEPTION 'SERIAL_QC_FAILED'
          USING HINT = 'Only serials with QC status PASS may be sold. Current status: ' || COALESCE(v_serial_qc, 'UNKNOWN');
      END IF;
    END IF;
    v_subtotal := v_subtotal + v_quantity * v_product.selling_price;
  END LOOP;

  v_sale_no := fn_next_number('RTS-SAL-', 'seq_sale');
  INSERT INTO sales (id, sale_number, customer_id, referral_partner_id, referral_source,
                     subtotal, discount, total_amount, amount_paid, balance_due,
                     payment_status, fulfilment_status, is_preorder, notes, created_by)
  VALUES (v_sale_id, v_sale_no, p_customer_id, p_referral_partner_id, p_referral_source,
          v_subtotal, 0, v_subtotal, 0, v_subtotal,
          'UNPAID', 'PENDING', p_is_preorder, p_notes, auth.uid());

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    INSERT INTO sale_items (sale_id, product_id, description, quantity, unit_price, discount, serial_number_id)
    VALUES (v_sale_id, v_product.id, v_product.description, (v_item->>'quantity')::INT,
            v_product.selling_price, 0, NULLIF(v_item->>'serial_number_id', '')::UUID);
  END LOOP;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'SALE_CREATED', 'sales', v_sale_id,
          jsonb_build_object('sale_number', v_sale_no, 'total', v_subtotal, 'preorder', p_is_preorder, 'qc_verified', true));

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_no, 'total_amount', v_subtotal);
END; $$;

-- Step 4: Re-create fn_record_payment with null-safe QC check
CREATE OR REPLACE FUNCTION fn_record_payment(
  p_sale_id   UUID,
  p_amount    NUMERIC,
  p_method    TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale          sales%ROWTYPE;
  v_item          RECORD;
  v_payment_id    UUID := gen_random_uuid();
  v_payment_no    TEXT;
  v_new_paid      NUMERIC;
  v_new_balance   NUMERIC;
  v_new_status    TEXT;
  v_first_payment BOOLEAN;
  v_has_install   BOOLEAN;
  v_unit_serial   UUID;
  v_serial_qc     TEXT;
BEGIN
  PERFORM fn_require_authenticated();
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALE_NOT_FOUND'; END IF;
  IF v_sale.payment_status = 'REFUNDED' THEN RAISE EXCEPTION 'SALE_ALREADY_REFUNDED'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  IF p_method = 'ECOCASH' AND
     (SELECT value FROM system_settings WHERE key='ecocash_enabled') <> 'true' THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_DISABLED';
  END IF;

  v_new_paid    := v_sale.amount_paid + p_amount;
  v_new_balance := v_sale.total_amount - v_new_paid;
  v_new_status  := CASE
    WHEN v_new_balance < 0                 THEN 'OVERPAID'
    WHEN v_new_paid >= v_sale.total_amount THEN 'PAID'
    ELSE 'PARTIAL' END;

  v_payment_no := fn_next_number('RTS-PAY-', 'seq_payment');
  INSERT INTO payments (id, payment_number, sale_id, customer_id, amount,
                        payment_method, payment_reference, status, received_by)
  VALUES (v_payment_id, v_payment_no, p_sale_id, v_sale.customer_id, p_amount,
          p_method, p_reference, 'CONFIRMED', auth.uid());

  UPDATE sales SET amount_paid = v_new_paid, balance_due = v_new_balance,
                   payment_status = v_new_status, updated_at = now()
  WHERE id = p_sale_id;

  INSERT INTO cash_movements (description, category, type, amount, source_type, source_id, created_by)
  VALUES ('Payment ' || v_payment_no || ' — sale ' || v_sale.sale_number,
          'CUSTOMER_REVENUE', 'IN', p_amount, 'PAYMENT', v_payment_id, auth.uid());

  SELECT COUNT(*) = 0 INTO v_first_payment
  FROM payments WHERE sale_id = p_sale_id AND id <> v_payment_id AND status = 'CONFIRMED';

  IF v_first_payment AND NOT v_sale.is_preorder THEN
    FOR v_item IN
      SELECT si.id AS item_id, si.serial_number_id, si.product_id
      FROM sale_items si JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = p_sale_id AND p.requires_serial
    LOOP
      IF v_item.serial_number_id IS NULL THEN RAISE EXCEPTION 'SERIAL_REQUIRED'; END IF;
      
      -- CRITICAL: Verify QC=PASS before reserving (null-safe)
      SELECT qc_status INTO v_serial_qc FROM serial_numbers
        WHERE id = v_item.serial_number_id AND status = 'AVAILABLE';
      IF v_serial_qc IS NULL OR v_serial_qc <> 'PASS' THEN
        RAISE EXCEPTION 'SERIAL_QC_FAILED_AT_PAYMENT'
          USING HINT = 'Serial QC status is ' || COALESCE(v_serial_qc, 'UNKNOWN') || '. Only PASS serials can be reserved.';
      END IF;
      
      UPDATE serial_numbers
         SET status='RESERVED', sale_id=p_sale_id, customer_id=v_sale.customer_id,
             sold_date=CURRENT_DATE, updated_at=now()
       WHERE id = v_item.serial_number_id AND status = 'AVAILABLE';
      IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_UNAVAILABLE'; END IF;
      PERFORM fn_refresh_inventory(v_item.product_id);
      v_unit_serial := v_item.serial_number_id;
    END LOOP;

    SELECT EXISTS(
      SELECT 1 FROM sale_items si JOIN products p ON p.id=si.product_id
      WHERE si.sale_id=p_sale_id AND p.requires_installation) INTO v_has_install;

    IF v_has_install AND v_unit_serial IS NOT NULL THEN
      PERFORM fn_create_install_job(p_sale_id, v_unit_serial);
    END IF;
  END IF;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'PAYMENT_RECORDED', 'payments', v_payment_id,
          jsonb_build_object('sale', v_sale.sale_number, 'amount', p_amount,
                             'method', p_method, 'new_status', v_new_status, 'qc_verified', true));

  RETURN jsonb_build_object(
    'payment_number', v_payment_no, 'amount', p_amount,
    'balance_due', v_new_balance, 'payment_status', v_new_status);
END; $$;

REVOKE EXECUTE ON FUNCTION fn_create_sale(UUID, UUID, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_create_sale(UUID, UUID, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION fn_record_payment(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_record_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
