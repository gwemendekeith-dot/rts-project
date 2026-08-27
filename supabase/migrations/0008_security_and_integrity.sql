-- RAFIKI OPERATIONS DESK — 0008_security_and_integrity.sql
-- Remediation: authenticated RPC execution and database invariants.
-- Apply after 0007. This migration is additive and preserves transaction history.

CREATE OR REPLACE FUNCTION fn_require_authenticated()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
END; $$;

-- SECURITY DEFINER functions must never be callable by anonymous clients.
REVOKE EXECUTE ON FUNCTION fn_refresh_inventory(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_require_authenticated() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_create_install_job(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_record_payment(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_schedule_installation(UUID, DATE, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_complete_installation(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT[], TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_issue_refund(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_receive_stock(UUID, TEXT[], DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_settle_obligation(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_void_document(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_issue_document(TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_create_customer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_set_serial_qc(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_adjust_serial_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_switch_role(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION fn_create_customer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_create_sale(UUID, UUID, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_record_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_schedule_installation(UUID, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_complete_installation(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_issue_refund(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_receive_stock(UUID, TEXT[], DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_settle_obligation(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_void_document(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_issue_document(TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION fn_receive_stock(
  p_product_id UUID, p_serials TEXT[], p_received_date DATE DEFAULT CURRENT_DATE)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s TEXT; n INT := 0; v_inserted INT;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND active = true) THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;
  FOREACH s IN ARRAY p_serials LOOP
    INSERT INTO serial_numbers (serial_number, product_id, status, received_date, qc_status)
    VALUES (trim(s), p_product_id, 'AVAILABLE', p_received_date, 'PENDING')
    ON CONFLICT (serial_number) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 1 THEN
      INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, movement_date, created_by, notes)
      VALUES (p_product_id, 'PURCHASE', 1, 'RECEIVING', now(), auth.uid(), 'Serial ' || trim(s));
      n := n + 1;
    END IF;
  END LOOP;
  PERFORM fn_refresh_inventory(p_product_id);
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION fn_settle_obligation(
  p_obligation_id UUID, p_amount NUMERIC, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ob obligations%ROWTYPE; v_paid NUMERIC;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_ob FROM obligations WHERE id = p_obligation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OBLIGATION_NOT_FOUND'; END IF;
  IF p_amount <= 0 OR p_amount > (v_ob.total_amount - v_ob.amount_paid) THEN
    RAISE EXCEPTION 'INVALID_SETTLEMENT_AMOUNT';
  END IF;
  v_paid := v_ob.amount_paid + p_amount;
  UPDATE obligations SET amount_paid = v_paid,
    status = CASE WHEN v_paid = total_amount THEN 'SETTLED' ELSE 'PARTIAL' END
  WHERE id = p_obligation_id;
  INSERT INTO cash_movements (description, category, type, amount, source_type, source_id, created_by)
  VALUES ('Obligation settlement — ' || v_ob.description, 'SUPPLIER_PAYMENT', 'OUT',
          p_amount, 'OBLIGATION', p_obligation_id, auth.uid());
  RETURN jsonb_build_object('obligation', v_ob.obligation_number,
    'amount_paid', v_paid, 'balance', v_ob.total_amount - v_paid);
END; $$;

CREATE OR REPLACE FUNCTION fn_adjust_serial_status(
  p_serial_id UUID, p_status TEXT, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_serial serial_numbers%ROWTYPE;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF p_status NOT IN ('AVAILABLE','RESERVED','ALLOCATED','INSTALLED','RETURNED','DAMAGED','SCRAPPED') THEN
    RAISE EXCEPTION 'INVALID_SERIAL_STATUS';
  END IF;
  SELECT * INTO v_serial FROM serial_numbers WHERE id = p_serial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_NOT_FOUND'; END IF;
  IF v_serial.status = 'INSTALLED' AND p_status <> 'RETURNED' THEN
    RAISE EXCEPTION 'INSTALLED_SERIAL_REQUIRES_RETURN';
  END IF;
  IF v_serial.status IN ('RESERVED','ALLOCATED') AND p_status = 'AVAILABLE' THEN
    RAISE EXCEPTION 'ACTIVE_RESERVATION_REQUIRES_REFUND';
  END IF;
  UPDATE serial_numbers SET status = p_status,
    sale_id = CASE WHEN p_status IN ('RESERVED','ALLOCATED','INSTALLED') THEN sale_id ELSE NULL END,
    customer_id = CASE WHEN p_status IN ('RESERVED','ALLOCATED','INSTALLED') THEN customer_id ELSE NULL END,
    installation_id = CASE WHEN p_status IN ('ALLOCATED','INSTALLED') THEN installation_id ELSE NULL END,
    updated_at = now()
  WHERE id = p_serial_id;
  PERFORM fn_refresh_inventory(v_serial.product_id);
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, reason)
  VALUES (auth.uid(), 'SERIAL_STATUS_ADJUSTED', 'serial_numbers', p_serial_id,
    jsonb_build_object('status', v_serial.status), jsonb_build_object('status', p_status), p_reason);
  RETURN jsonb_build_object('serial_number', v_serial.serial_number, 'status', p_status);
END; $$;

CREATE OR REPLACE FUNCTION fn_issue_refund(
  p_payment_id UUID, p_amount NUMERIC, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pay payments%ROWTYPE; v_sale sales%ROWTYPE; v_done_job BOOLEAN;
  v_prior NUMERIC; v_refund_no TEXT; v_new_paid NUMERIC; v_item RECORD;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  SELECT * INTO v_sale FROM sales WHERE id = v_pay.sale_id FOR UPDATE;
  SELECT EXISTS (SELECT 1 FROM installations WHERE sale_id = v_sale.id AND status = 'COMPLETED') INTO v_done_job;
  IF v_done_job THEN RAISE EXCEPTION 'INSTALLATION_COMPLETE_NO_REFUND'; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_prior FROM refunds WHERE payment_id = p_payment_id AND status = 'CONFIRMED';
  IF p_amount <= 0 OR p_amount > v_pay.amount - v_prior THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT'; END IF;
  v_refund_no := fn_next_number('RTS-RFD-', 'seq_refund');
  INSERT INTO refunds (refund_number, payment_id, sale_id, amount, method, reason, status, processed_by, processed_at)
  VALUES (v_refund_no, p_payment_id, v_sale.id, p_amount, v_pay.payment_method, p_reason, 'CONFIRMED', auth.uid(), now());
  INSERT INTO cash_movements (description, category, type, amount, source_type, source_id, created_by)
  VALUES ('Refund ' || v_refund_no || ' — sale ' || v_sale.sale_number, 'REFUND', 'OUT', p_amount, 'REFUND', p_payment_id, auth.uid());
  v_new_paid := v_sale.amount_paid - p_amount;
  IF v_new_paid <= 0 THEN
    UPDATE sales SET amount_paid = 0, balance_due = total_amount, payment_status = 'REFUNDED', fulfilment_status = 'CANCELLED', updated_at = now() WHERE id = v_sale.id;
    UPDATE payments SET status = 'REFUNDED' WHERE id = p_payment_id;
    FOR v_item IN SELECT * FROM serial_numbers WHERE sale_id = v_sale.id AND status IN ('RESERVED','ALLOCATED') LOOP
      UPDATE serial_numbers SET status = 'AVAILABLE', sale_id = NULL, customer_id = NULL, sold_date = NULL, updated_at = now() WHERE id = v_item.id;
      INSERT INTO inventory_movements (product_id, serial_number_id, movement_type, quantity, reference_type, reference_id, created_by)
      VALUES (v_item.product_id, v_item.id, 'RELEASE', 1, 'REFUND', p_payment_id, auth.uid());
      PERFORM fn_refresh_inventory(v_item.product_id);
    END LOOP;
  ELSE
    UPDATE sales SET amount_paid = v_new_paid, balance_due = total_amount - v_new_paid, payment_status = 'PARTIALLY_REFUNDED', updated_at = now() WHERE id = v_sale.id;
    UPDATE payments SET status = 'PARTIALLY_REFUNDED' WHERE id = p_payment_id;
  END IF;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
  VALUES (auth.uid(), 'REFUND_ISSUED', 'refunds', p_payment_id, jsonb_build_object('sale', v_sale.sale_number, 'amount', p_amount), p_reason);
  RETURN jsonb_build_object('refund_number', v_refund_no, 'amount', p_amount,
    'sale_payment_status', CASE WHEN v_new_paid <= 0 THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END);
END; $$;
GRANT EXECUTE ON FUNCTION fn_set_serial_qc(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_adjust_serial_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_switch_role(TEXT) TO authenticated;

-- Replace the client-price sale function with a server-priced version.
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
      IF NOT EXISTS (SELECT 1 FROM serial_numbers WHERE id = v_serial_id
                     AND product_id = v_product.id AND status = 'AVAILABLE') THEN
        RAISE EXCEPTION 'SERIAL_UNAVAILABLE';
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
          jsonb_build_object('sale_number', v_sale_no, 'total', v_subtotal, 'preorder', p_is_preorder));
  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_no, 'total_amount', v_subtotal);
END; $$;

REVOKE EXECUTE ON FUNCTION fn_create_sale(UUID, UUID, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_create_sale(UUID, UUID, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;

-- Prevent accepting malformed serial identifiers during receiving.
CREATE OR REPLACE FUNCTION fn_validate_serial_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sku TEXT;
BEGIN
  SELECT sku INTO v_sku FROM products WHERE id = NEW.product_id;
  IF v_sku IS NULL THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  IF NEW.serial_number !~ ('^' || regexp_replace(v_sku, '[^A-Za-z0-9-]', '', 'g') || '-[0-9]{3,}$') THEN
    RAISE EXCEPTION 'INVALID_SERIAL_FORMAT';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_serial_product ON serial_numbers;
CREATE TRIGGER trg_validate_serial_product
  BEFORE INSERT OR UPDATE OF serial_number, product_id ON serial_numbers
  FOR EACH ROW EXECUTE FUNCTION fn_validate_serial_product();

-- Financial inputs must remain non-negative and bounded.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS chk_sales_financials;
ALTER TABLE sales ADD CONSTRAINT chk_sales_financials
  CHECK (subtotal >= 0 AND discount >= 0 AND total_amount >= 0 AND amount_paid >= 0);

ALTER TABLE obligations DROP CONSTRAINT IF EXISTS chk_obligation_amounts;
ALTER TABLE obligations ADD CONSTRAINT chk_obligation_amounts
  CHECK (total_amount >= 0 AND amount_paid >= 0 AND amount_paid <= total_amount);

-- Direct document creation must preserve the source cardinality rules already in 0001.
CREATE OR REPLACE FUNCTION fn_issue_document(
  p_type TEXT,
  p_customer_id UUID,
  p_sale_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL,
  p_quote_id UUID DEFAULT NULL,
  p_installation_id UUID DEFAULT NULL,
  p_warranty_id UUID DEFAULT NULL,
  p_template_version TEXT DEFAULT 'v1.0'
)
RETURNS documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix TEXT; v_seq TEXT; v_number TEXT; v_doc documents%ROWTYPE;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() NOT IN ('OWNER', 'SALES') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;
  IF p_type = 'INVOICE' AND p_sale_id IS NULL THEN RAISE EXCEPTION 'SALE_REQUIRED'; END IF;
  IF p_type = 'RECEIPT' AND p_payment_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_REQUIRED'; END IF;
  IF p_type = 'WARRANTY_CERTIFICATE' AND p_warranty_id IS NULL THEN RAISE EXCEPTION 'WARRANTY_REQUIRED'; END IF;
  IF p_type = 'INSTALLATION_REPORT' AND p_installation_id IS NULL THEN RAISE EXCEPTION 'INSTALLATION_REQUIRED'; END IF;

  CASE p_type
    WHEN 'QUOTE' THEN v_prefix := 'RTS-QTE-'; v_seq := 'seq_quote';
    WHEN 'INVOICE' THEN v_prefix := 'RTS-INV-'; v_seq := 'seq_invoice';
    WHEN 'RECEIPT' THEN v_prefix := 'RTS-RCP-'; v_seq := 'seq_receipt';
    WHEN 'WARRANTY_CERTIFICATE' THEN v_prefix := 'RTS-WTY-'; v_seq := 'seq_warranty_certificate';
    WHEN 'INSTALLATION_REPORT' THEN v_prefix := 'RTS-INS-'; v_seq := 'seq_installation_report';
    ELSE RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END CASE;

  v_number := fn_next_number(v_prefix, v_seq);
  INSERT INTO documents (document_number, document_type, customer_id, sale_id,
    payment_id, quote_id, installation_id, warranty_id, template_version, status, created_by)
  VALUES (v_number, p_type, p_customer_id, p_sale_id, p_payment_id, p_quote_id,
    p_installation_id, p_warranty_id, p_template_version, 'ISSUED', auth.uid())
  RETURNING * INTO v_doc;
  RETURN v_doc;
END; $$;

REVOKE EXECUTE ON FUNCTION fn_issue_document(TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_issue_document(TEXT, UUID, UUID, UUID, UUID, UUID, UUID, TEXT) TO authenticated;
