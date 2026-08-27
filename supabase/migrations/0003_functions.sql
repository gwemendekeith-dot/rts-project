-- ============================================================
-- RAFIKI OPERATIONS DESK — 0003_functions.sql
-- Atomic business-logic engine. All mutations are single
-- transactions; partial state is impossible.
-- Apply order: 3 of 4 (after schema + RLS).
-- ============================================================

-- ---------- Inventory refresh (compute, don't duplicate) ----------
CREATE OR REPLACE FUNCTION fn_refresh_inventory(p_product_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_serialised BOOLEAN;
BEGIN
  SELECT requires_serial INTO v_serialised FROM products WHERE id = p_product_id;
  IF v_serialised THEN
    UPDATE inventory SET
      quantity_on_hand  = (SELECT COUNT(*) FROM serial_numbers
                           WHERE product_id = p_product_id
                             AND status IN ('AVAILABLE','RESERVED','ALLOCATED')),
      quantity_reserved = (SELECT COUNT(*) FROM serial_numbers
                           WHERE product_id = p_product_id
                             AND status IN ('RESERVED','ALLOCATED')),
      updated_at = now()
    WHERE product_id = p_product_id;
  ELSE
    UPDATE inventory SET
      quantity_on_hand = (SELECT COALESCE(SUM(quantity),0)
                          FROM inventory_movements WHERE product_id = p_product_id),
      updated_at = now()
    WHERE product_id = p_product_id;
  END IF;
END; $$;

-- ---------- Create install job + pending warranty ----------
CREATE OR REPLACE FUNCTION fn_create_install_job(p_sale_id UUID, p_serial_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale sales%ROWTYPE; v_job_id UUID := gen_random_uuid();
  v_job_no TEXT; v_wty_no TEXT; v_prod UUID; v_addr TEXT;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  SELECT product_id INTO v_prod FROM serial_numbers WHERE id = p_serial_id;
  SELECT address INTO v_addr FROM customers WHERE id = v_sale.customer_id;
  v_job_no := fn_next_number('RTS-JOB-', 'seq_job');

  INSERT INTO installations (id, job_number, sale_id, customer_id, serial_number_id,
                             address, status)
  VALUES (v_job_id, v_job_no, p_sale_id, v_sale.customer_id, p_serial_id,
          COALESCE(v_addr, ''), 'PENDING');

  v_wty_no := fn_next_number('RTS-WTY-', 'seq_warranty');
  INSERT INTO warranties (warranty_number, serial_number_id, customer_id, sale_id,
                          installation_id, status)
  VALUES (v_wty_no, p_serial_id, v_sale.customer_id, p_sale_id, v_job_id, 'PENDING');

  RETURN v_job_id;
END; $$;

-- ---------- Record payment (deposit or balance) ----------
CREATE OR REPLACE FUNCTION fn_record_payment(
  p_sale_id   UUID,
  p_amount    NUMERIC,
  p_method    TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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
BEGIN
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
                             'method', p_method, 'new_status', v_new_status));

  RETURN jsonb_build_object(
    'payment_number', v_payment_no, 'amount', p_amount,
    'balance_due', v_new_balance, 'payment_status', v_new_status);
END; $$;

-- ---------- Schedule installation ----------
CREATE OR REPLACE FUNCTION fn_schedule_installation(
  p_job_id UUID, p_date DATE, p_installer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_job installations%ROWTYPE; v_prod UUID;
BEGIN
  SELECT * INTO v_job FROM installations WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
  UPDATE installations SET status='SCHEDULED', scheduled_date=p_date,
         installer_id=p_installer_id, updated_at=now() WHERE id=p_job_id;
  UPDATE serial_numbers SET status='ALLOCATED', updated_at=now()
  WHERE id=v_job.serial_number_id;
  SELECT product_id INTO v_prod FROM serial_numbers WHERE id=v_job.serial_number_id;
  PERFORM fn_refresh_inventory(v_prod);
  UPDATE sales SET fulfilment_status='SCHEDULED', updated_at=now() WHERE id=v_job.sale_id;
  RETURN jsonb_build_object('job', v_job.job_number, 'scheduled_date', p_date);
END; $$;

-- ---------- Complete installation (activates warranty) ----------
CREATE OR REPLACE FUNCTION fn_complete_installation(
  p_job_id            UUID,
  p_gas_test          BOOLEAN,
  p_water_test        BOOLEAN,
  p_unit_test         BOOLEAN,
  p_customer_handover BOOLEAN,
  p_signature_ref     TEXT,
  p_photo_refs        TEXT[] DEFAULT NULL,
  p_installer_notes   TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job      installations%ROWTYPE;
  v_wty      warranties%ROWTYPE;
  v_duration INT; v_expiry DATE; v_fee NUMERIC; v_product UUID;
BEGIN
  SELECT * INTO v_job FROM installations WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
  IF v_job.status = 'COMPLETED' THEN RAISE EXCEPTION 'JOB_ALREADY_COMPLETED'; END IF;

  IF NOT (p_gas_test AND p_water_test AND p_unit_test AND p_customer_handover) THEN
    RAISE EXCEPTION 'CHECKLIST_INCOMPLETE';
  END IF;
  IF p_signature_ref IS NULL THEN RAISE EXCEPTION 'SIGNATURE_REQUIRED'; END IF;

  v_fee := (SELECT value::NUMERIC FROM system_settings WHERE key='installer_fee');

  UPDATE installations SET
    status='COMPLETED', completed_at=now(),
    gas_test=p_gas_test, water_test=p_water_test, unit_test=p_unit_test,
    customer_handover=p_customer_handover, customer_signature=p_signature_ref,
    photo_refs=p_photo_refs, installer_notes=p_installer_notes,
    installer_payout_due=v_fee, installer_payout_status='UNPAID', updated_at=now()
  WHERE id = p_job_id;

  UPDATE serial_numbers SET status='INSTALLED', installation_id=p_job_id,
         installed_date=CURRENT_DATE, updated_at=now()
  WHERE id = v_job.serial_number_id;
  SELECT product_id INTO v_product FROM serial_numbers WHERE id = v_job.serial_number_id;
  PERFORM fn_refresh_inventory(v_product);

  INSERT INTO inventory_movements (product_id, serial_number_id, movement_type, quantity,
                                   reference_type, reference_id, created_by)
  VALUES (v_product, v_job.serial_number_id, 'SALE', -1, 'INSTALLATION', p_job_id, auth.uid());

  v_duration := (SELECT value::INT FROM system_settings WHERE key='warranty_default_months');
  v_expiry   := (CURRENT_DATE + make_interval(months => v_duration))::DATE;

  UPDATE warranties SET status='ACTIVE', start_date=CURRENT_DATE,
         expiry_date=v_expiry, updated_at=now()
  WHERE installation_id = p_job_id
  RETURNING * INTO v_wty;

  UPDATE sales SET fulfilment_status='INSTALLED', updated_at=now() WHERE id = v_job.sale_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'INSTALLATION_COMPLETED', 'installations', p_job_id,
          jsonb_build_object('job', v_job.job_number, 'warranty_expiry', v_expiry,
                             'installer_payout', v_fee));

  RETURN jsonb_build_object(
    'job', v_job.job_number, 'warranty_number', v_wty.warranty_number,
    'warranty_start', CURRENT_DATE, 'warranty_expiry', v_expiry,
    'installer_payout_due', v_fee);
END; $$;

-- ---------- Issue refund (with Clause 3 gate) ----------
CREATE OR REPLACE FUNCTION fn_issue_refund(
  p_payment_id UUID, p_amount NUMERIC, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pay payments%ROWTYPE; v_sale sales%ROWTYPE; v_done_job BOOLEAN;
  v_prior NUMERIC; v_refund_no TEXT; v_new_paid NUMERIC; v_item RECORD;
BEGIN
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  SELECT * INTO v_sale FROM sales WHERE id = v_pay.sale_id FOR UPDATE;

  SELECT EXISTS(SELECT 1 FROM installations
                WHERE sale_id = v_sale.id AND status = 'COMPLETED') INTO v_done_job;
  IF v_done_job THEN
    RAISE EXCEPTION 'INSTALLATION_COMPLETE_NO_REFUND'
      USING HINT = 'Sale is final after installation. Use a warranty claim instead.';
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_prior
  FROM refunds WHERE payment_id = p_payment_id AND status='CONFIRMED';
  IF p_amount <= 0 OR p_amount > (v_pay.amount - v_prior) THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT';
  END IF;

  v_refund_no := fn_next_number('RTS-RFD-', 'seq_refund');
  INSERT INTO refunds (refund_number, payment_id, sale_id, amount, method, reason,
                       status, processed_by, processed_at)
  VALUES (v_refund_no, p_payment_id, v_sale.id, p_amount, v_pay.payment_method,
          p_reason, 'CONFIRMED', auth.uid(), now());

  INSERT INTO cash_movements (description, category, type, amount, source_type, source_id, created_by)
  VALUES ('Refund ' || v_refund_no || ' — sale ' || v_sale.sale_number,
          'REFUND', 'OUT', p_amount, 'REFUND', v_pay.id, auth.uid());

  v_new_paid := v_sale.amount_paid - p_amount;
  IF v_new_paid <= 0 THEN
    UPDATE sales SET amount_paid=0, balance_due=v_sale.total_amount,
           payment_status='REFUNDED', fulfilment_status='CANCELLED', updated_at=now()
    WHERE id = v_sale.id;
    UPDATE payments SET status='REFUNDED' WHERE id = p_payment_id;
    FOR v_item IN SELECT * FROM serial_numbers WHERE sale_id = v_sale.id
                  AND status IN ('RESERVED','ALLOCATED')
    LOOP
      UPDATE serial_numbers SET status='AVAILABLE', sale_id=NULL,
             customer_id=NULL, sold_date=NULL, updated_at=now()
      WHERE id = v_item.id;
      INSERT INTO inventory_movements (product_id, serial_number_id, movement_type,
              quantity, reference_type, reference_id, created_by)
      VALUES (v_item.product_id, v_item.id, 'RELEASE', 0, 'REFUND', v_pay.id, auth.uid());
      PERFORM fn_refresh_inventory(v_item.product_id);
    END LOOP;
  ELSE
    UPDATE sales SET amount_paid=v_new_paid, balance_due=v_sale.total_amount - v_new_paid,
           payment_status='PARTIALLY_REFUNDED', updated_at=now()
    WHERE id = v_sale.id;
    UPDATE payments SET status='PARTIALLY_REFUNDED' WHERE id = p_payment_id;
  END IF;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
  VALUES (auth.uid(), 'REFUND_ISSUED', 'refunds', p_payment_id,
          jsonb_build_object('sale', v_sale.sale_number, 'amount', p_amount), p_reason);

  RETURN jsonb_build_object('refund_number', v_refund_no, 'amount', p_amount,
    'sale_payment_status', CASE WHEN v_new_paid <= 0 THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END);
END; $$;

-- ---------- Receive stock (bulk serials) ----------
CREATE OR REPLACE FUNCTION fn_receive_stock(
  p_product_id UUID, p_serials TEXT[], p_received_date DATE DEFAULT CURRENT_DATE)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE s TEXT; n INT := 0;
BEGIN
  FOREACH s IN ARRAY p_serials LOOP
    INSERT INTO serial_numbers (serial_number, product_id, status, received_date, qc_status)
    VALUES (s, p_product_id, 'AVAILABLE', p_received_date, 'PENDING')
    ON CONFLICT (serial_number) DO NOTHING;
    INSERT INTO inventory_movements (product_id, movement_type, quantity,
            reference_type, movement_date, created_by, notes)
    VALUES (p_product_id, 'PURCHASE', 1, 'RECEIVING', now(), auth.uid(), 'Serial ' || s);
    n := n + 1;
  END LOOP;
  PERFORM fn_refresh_inventory(p_product_id);
  RETURN n;
END; $$;

-- ---------- Settle obligation ----------
CREATE OR REPLACE FUNCTION fn_settle_obligation(
  p_obligation_id UUID, p_amount NUMERIC, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_ob obligations%ROWTYPE; v_paid NUMERIC;
BEGIN
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_ob FROM obligations WHERE id = p_obligation_id FOR UPDATE;
  v_paid := v_ob.amount_paid + p_amount;
  UPDATE obligations SET amount_paid = v_paid,
         status = CASE WHEN v_paid >= total_amount THEN 'SETTLED' ELSE 'PARTIAL' END
  WHERE id = p_obligation_id;
  INSERT INTO cash_movements (description, category, type, amount, source_type, source_id, created_by)
  VALUES ('Obligation settlement — ' || v_ob.description, 'SUPPLIER_PAYMENT', 'OUT',
          p_amount, 'OBLIGATION', p_obligation_id, auth.uid());
  RETURN jsonb_build_object('obligation', v_ob.obligation_number,
                            'amount_paid', v_paid, 'balance', v_ob.total_amount - v_paid);
END; $$;

-- ---------- Void document ----------
CREATE OR REPLACE FUNCTION fn_void_document(p_document_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_doc documents%ROWTYPE;
BEGIN
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id FOR UPDATE;
  IF v_doc.status = 'VOID' THEN RAISE EXCEPTION 'ALREADY_VOID'; END IF;
  UPDATE documents SET status='VOID' WHERE id = p_document_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, reason)
  VALUES (auth.uid(), 'DOCUMENT_VOIDED', 'documents', p_document_id, p_reason);
  RETURN jsonb_build_object('document', v_doc.document_number, 'status', 'VOID');
END; $$;

-- ---------- Scheduled sweeps ----------
CREATE OR REPLACE FUNCTION fn_sweep_warranty_expiry()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE n INT;
BEGIN
  UPDATE warranties SET status='EXPIRED', updated_at=now()
  WHERE status='ACTIVE' AND expiry_date < CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION fn_sweep_quote_expiry()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE n INT;
BEGIN
  UPDATE quotes SET status='EXPIRED', updated_at=now()
  WHERE status IN ('SENT','VIEWED') AND valid_until < CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END; $$;

-- To activate nightly sweeps, run once in SQL editor:
-- SELECT cron.schedule('warranty-expiry','0 2 * * *','SELECT fn_sweep_warranty_expiry()');
-- SELECT cron.schedule('quote-expiry','0 2 * * *','SELECT fn_sweep_quote_expiry()');
