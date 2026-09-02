-- RAFIKI OPERATIONS DESK — 0012_sale_cancellation.sql
-- Auditable cancellation: never delete financial history.

-- Replace the legacy refund implementation so full refunds remain compatible
-- with the non-zero inventory movement constraint and do not silently cancel
-- the sale before the operator confirms cancellation.
CREATE OR REPLACE FUNCTION fn_issue_refund(
  p_payment_id UUID, p_amount NUMERIC, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pay payments%ROWTYPE; v_sale sales%ROWTYPE; v_done_job BOOLEAN;
  v_prior NUMERIC; v_refund_no TEXT; v_new_paid NUMERIC;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  SELECT * INTO v_sale FROM sales WHERE id = v_pay.sale_id FOR UPDATE;
  SELECT EXISTS(SELECT 1 FROM installations WHERE sale_id = v_sale.id AND status = 'COMPLETED') INTO v_done_job;
  IF v_done_job THEN RAISE EXCEPTION 'INSTALLATION_COMPLETE_NO_REFUND'; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_prior FROM refunds WHERE payment_id = p_payment_id AND status = 'CONFIRMED';
  IF p_amount <= 0 OR p_amount > (v_pay.amount - v_prior) THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT'; END IF;
  v_refund_no := fn_next_number('RTS-RFD-', 'seq_refund');
  INSERT INTO refunds (refund_number, payment_id, sale_id, amount, method, reason, status, processed_by, processed_at)
  VALUES (v_refund_no, p_payment_id, v_sale.id, p_amount, v_pay.payment_method, p_reason, 'CONFIRMED', auth.uid(), now());
  INSERT INTO cash_movements (description, category, type, amount, source_type, source_id, created_by)
  VALUES ('Refund ' || v_refund_no || ' — sale ' || v_sale.sale_number, 'REFUND', 'OUT', p_amount, 'REFUND', v_pay.id, auth.uid());
  v_new_paid := greatest(v_sale.amount_paid - p_amount, 0);
  UPDATE sales SET amount_paid = v_new_paid, balance_due = v_sale.total_amount - v_new_paid,
    payment_status = CASE WHEN v_new_paid = 0 THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END, updated_at = now()
    WHERE id = v_sale.id;
  UPDATE payments SET status = CASE WHEN p_amount = v_pay.amount - v_prior THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END
    WHERE id = p_payment_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
  VALUES (auth.uid(), 'REFUND_ISSUED', 'refunds', p_payment_id,
    jsonb_build_object('sale', v_sale.sale_number, 'amount', p_amount), p_reason);
  RETURN jsonb_build_object('refund_number', v_refund_no, 'amount', p_amount,
    'sale_payment_status', CASE WHEN v_new_paid = 0 THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END);
END; $$;

CREATE OR REPLACE FUNCTION fn_cancel_sale(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_payment RECORD;
  v_serial RECORD;
  v_doc RECORD;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALE_NOT_FOUND'; END IF;
  IF v_sale.fulfilment_status = 'CANCELLED' THEN RAISE EXCEPTION 'SALE_ALREADY_CANCELLED'; END IF;
  IF EXISTS (SELECT 1 FROM installations WHERE sale_id = p_sale_id AND status IN ('COMPLETED','INSTALLED')) THEN
    RAISE EXCEPTION 'INSTALLATION_COMPLETE_NO_CANCEL'
      USING HINT = 'Completed installations must be handled through the warranty process.';
  END IF;

  -- Every confirmed payment must have been fully refunded manually first.
  FOR v_payment IN
    SELECT p.id, p.amount, COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'CONFIRMED'), 0) AS refunded
    FROM payments p
    LEFT JOIN refunds r ON r.payment_id = p.id
    WHERE p.sale_id = p_sale_id AND p.status IN ('CONFIRMED','PARTIALLY_REFUNDED')
    GROUP BY p.id, p.amount
  LOOP
    IF v_payment.refunded < v_payment.amount THEN
      RAISE EXCEPTION 'REFUNDS_REQUIRED_BEFORE_CANCEL'
        USING HINT = 'Refund every confirmed payment before cancelling this sale.';
    END IF;
  END LOOP;

  -- Release only active reservations; installed history is never rewritten.
  FOR v_serial IN
    SELECT id, product_id FROM serial_numbers
    WHERE sale_id = p_sale_id AND status IN ('RESERVED','ALLOCATED')
    FOR UPDATE
  LOOP
    UPDATE serial_numbers
       SET status = 'AVAILABLE', sale_id = NULL, customer_id = NULL,
           installation_id = NULL, sold_date = NULL, updated_at = now()
     WHERE id = v_serial.id;
    INSERT INTO inventory_movements
      (product_id, serial_number_id, movement_type, quantity, reference_type, reference_id, created_by)
    VALUES (v_serial.product_id, v_serial.id, 'RELEASE', 1, 'CANCELLATION', p_sale_id, auth.uid());
    PERFORM fn_refresh_inventory(v_serial.product_id);
  END LOOP;

  UPDATE installations
     SET status = 'CANCELLED', updated_at = now()
   WHERE sale_id = p_sale_id AND status NOT IN ('COMPLETED','INSTALLED','CANCELLED');

  -- Invoices are voided automatically; receipts remain historical evidence.
  FOR v_doc IN
    SELECT id, document_number, status FROM documents
    WHERE sale_id = p_sale_id AND document_type = 'INVOICE' AND status <> 'VOID'
    FOR UPDATE
  LOOP
    UPDATE documents SET status = 'VOID' WHERE id = v_doc.id;
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, reason)
    VALUES (auth.uid(), 'DOCUMENT_VOIDED', 'documents', v_doc.id,
      jsonb_build_object('status', v_doc.status, 'document_number', v_doc.document_number),
      jsonb_build_object('status', 'VOID', 'document_number', v_doc.document_number),
      'Automatic invoice void on sale cancellation: ' || trim(p_reason));
  END LOOP;

  UPDATE sales SET fulfilment_status = 'CANCELLED', updated_at = now()
   WHERE id = p_sale_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, reason)
  VALUES (auth.uid(), 'SALE_CANCELLED', 'sales', p_sale_id,
    jsonb_build_object('fulfilment_status', v_sale.fulfilment_status,
                       'payment_status', v_sale.payment_status),
    jsonb_build_object('fulfilment_status', 'CANCELLED',
                       'payment_status', v_sale.payment_status),
    trim(p_reason));

  RETURN jsonb_build_object('sale_id', p_sale_id, 'sale_number', v_sale.sale_number,
                            'status', 'CANCELLED');
END; $$;

REVOKE EXECUTE ON FUNCTION fn_cancel_sale(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_cancel_sale(UUID, TEXT) TO authenticated;
