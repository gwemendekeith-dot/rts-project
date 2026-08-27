-- ============================================================
-- RAFIKI OPERATIONS DESK — 0006_sale_and_dashboard.sql
-- Atomic sale creation + dashboard summary view.
-- Apply order: after 0005.
-- ============================================================

-- ---------- Atomic sale + line-item creation ----------
CREATE OR REPLACE FUNCTION fn_create_sale(
  p_customer_id       UUID,
  p_referral_partner_id UUID DEFAULT NULL,
  p_referral_source   TEXT DEFAULT NULL,
  p_is_preorder       BOOLEAN DEFAULT false,
  p_notes             TEXT DEFAULT NULL,
  p_items             JSONB DEFAULT '[]'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale_id  UUID := gen_random_uuid();
  v_sale_no  TEXT;
  v_item     JSONB;
  v_product  products%ROWTYPE;
  v_subtotal NUMERIC := 0;
  v_serial_status TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
    IF NOT v_product.active THEN RAISE EXCEPTION 'PRODUCT_INACTIVE'; END IF;

    IF v_product.requires_serial AND NOT p_is_preorder THEN
      IF v_item->>'serial_number_id' IS NULL THEN
        RAISE EXCEPTION 'SERIAL_REQUIRED';
      END IF;
      SELECT status INTO v_serial_status FROM serial_numbers
        WHERE id = (v_item->>'serial_number_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_NOT_FOUND'; END IF;
      IF v_serial_status <> 'AVAILABLE' THEN RAISE EXCEPTION 'SERIAL_UNAVAILABLE'; END IF;
    END IF;

    v_subtotal := v_subtotal +
      ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC
       - COALESCE((v_item->>'discount')::NUMERIC, 0));
  END LOOP;

  v_sale_no := fn_next_number('RTS-SAL-', 'seq_sale');

  INSERT INTO sales (id, sale_number, customer_id, referral_partner_id, referral_source,
                     subtotal, discount, total_amount, amount_paid, balance_due,
                     payment_status, fulfilment_status, is_preorder, notes, created_by)
  VALUES (v_sale_id, v_sale_no, p_customer_id, p_referral_partner_id, p_referral_source,
          v_subtotal, 0, v_subtotal, 0, v_subtotal,
          'UNPAID', 'PENDING', p_is_preorder, p_notes, auth.uid());

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    INSERT INTO sale_items (sale_id, product_id, description, quantity, unit_price,
                            discount, serial_number_id)
    VALUES (v_sale_id, v_product.id, v_product.description,
            (v_item->>'quantity')::INT, (v_item->>'unit_price')::NUMERIC,
            COALESCE((v_item->>'discount')::NUMERIC, 0),
            CASE WHEN v_item->>'serial_number_id' IS NOT NULL
                 THEN (v_item->>'serial_number_id')::UUID ELSE NULL END);
  END LOOP;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'SALE_CREATED', 'sales', v_sale_id,
          jsonb_build_object('sale_number', v_sale_no, 'total', v_subtotal,
                             'preorder', p_is_preorder));

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_no,
                            'total_amount', v_subtotal);
END; $$;

-- ---------- Server-computed dashboard summary ----------
CREATE OR REPLACE VIEW v_dashboard AS
SELECT
  (SELECT COUNT(*) FROM sales WHERE sale_date::date = CURRENT_DATE)                       AS sales_today,
  (SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE sale_date::date = CURRENT_DATE)  AS revenue_today,
  (SELECT COALESCE(SUM(amount),0) FROM payments
     WHERE payment_date::date = CURRENT_DATE AND status = 'CONFIRMED')                    AS cash_collected_today,
  (SELECT COUNT(*) FROM installations
     WHERE scheduled_date = CURRENT_DATE AND status NOT IN ('CANCELLED','COMPLETED'))     AS installations_today,
  (SELECT COALESCE((SELECT running_balance FROM v_cash_position
      ORDER BY movement_date DESC, created_at DESC LIMIT 1), 0))                          AS current_cash_balance,
  (SELECT COUNT(*) FROM obligations
     WHERE status <> 'SETTLED' AND due_date <= CURRENT_DATE + 30)                         AS obligations_due_soon,
  (SELECT COUNT(*) FROM quotes
     WHERE status IN ('SENT','VIEWED') AND valid_until IS NOT NULL
       AND valid_until <= CURRENT_DATE + 2)                                               AS quotes_expiring_soon,
  (SELECT COUNT(*) FROM v_stock_dashboard WHERE restock_status = 'REORDER_NOW')           AS low_stock_skus;
