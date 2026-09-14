-- ============================================================
-- RAFIKI OPERATIONS DESK — 0017_create_sale_full.sql
-- Atomic checkout RPC: unifies customer creation/lookup, sale
-- creation, payment recording, serial reservation, installation
-- job initialization, and document row generation in ONE transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_create_sale_full(
  p_customer   JSONB,              -- { customer_id?, first_name, last_name?, phone, address?, city?, customer_type?, referral_source?, notes? }
  p_items      JSONB,              -- array of { product_id, quantity, serial_number_id?, discount? }
  p_payment    JSONB DEFAULT NULL, -- { amount, payment_method, reference }
  p_sale_meta  JSONB DEFAULT '{}'  -- { referral_partner_id, notes, is_preorder }
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_id     UUID;
  v_customer_number TEXT;
  v_cust_res        JSONB;
  v_sale_res        JSONB;
  v_sale_id         UUID;
  v_sale_number     TEXT;
  v_total_amount    NUMERIC;
  v_payment_res     JSONB;
  v_payment_id      UUID;
  v_payment_number  TEXT;
  v_inv_doc         documents%ROWTYPE;
  v_rcp_doc         documents%ROWTYPE;
  v_is_preorder     BOOLEAN;
  v_payment_amount  NUMERIC;
BEGIN
  PERFORM fn_require_authenticated();
  IF current_user_role() NOT IN ('OWNER', 'SALES') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- 1. Resolve or Create Customer
  IF p_customer->>'customer_id' IS NOT NULL AND trim(p_customer->>'customer_id') <> '' THEN
    v_customer_id := (p_customer->>'customer_id')::UUID;
    SELECT customer_number INTO v_customer_number
      FROM customers
     WHERE id = v_customer_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
    END IF;
  ELSE
    v_cust_res := fn_create_customer(
      p_first_name      := p_customer->>'first_name',
      p_phone           := p_customer->>'phone',
      p_last_name       := p_customer->>'last_name',
      p_email           := p_customer->>'email',
      p_address         := p_customer->>'address',
      p_city            := COALESCE(p_customer->>'city', 'Harare'),
      p_customer_type   := COALESCE(p_customer->>'customer_type', 'RESIDENTIAL'),
      p_referral_source := p_customer->>'referral_source',
      p_notes           := p_customer->>'notes'
    );
    v_customer_id     := (v_cust_res->>'customer_id')::UUID;
    v_customer_number := v_cust_res->>'customer_number';
  END IF;

  -- 2. Create Sale & Line Items
  v_is_preorder := COALESCE((p_sale_meta->>'is_preorder')::BOOLEAN, false);
  v_sale_res := fn_create_sale(
    p_customer_id         := v_customer_id,
    p_referral_partner_id := NULLIF(p_sale_meta->>'referral_partner_id', '')::UUID,
    p_referral_source     := p_sale_meta->>'referral_source',
    p_is_preorder         := v_is_preorder,
    p_notes               := p_sale_meta->>'notes',
    p_items               := p_items
  );
  v_sale_id      := (v_sale_res->>'sale_id')::UUID;
  v_sale_number  := v_sale_res->>'sale_number';
  v_total_amount := (v_sale_res->>'total_amount')::NUMERIC;

  -- 3. Record Initial Payment (if provided)
  v_payment_amount := COALESCE((p_payment->>'amount')::NUMERIC, 0);
  IF p_payment IS NOT NULL AND v_payment_amount > 0 THEN
    v_payment_res := fn_record_payment(
      p_sale_id   := v_sale_id,
      p_amount    := v_payment_amount,
      p_method    := p_payment->>'payment_method',
      p_reference := NULLIF(p_payment->>'reference', '')
    );
    v_payment_number := v_payment_res->>'payment_number';
    SELECT id INTO v_payment_id FROM payments WHERE payment_number = v_payment_number;

    -- Issue Receipt Document Row
    v_rcp_doc := fn_issue_document(
      p_type        := 'RECEIPT',
      p_customer_id := v_customer_id,
      p_sale_id     := v_sale_id,
      p_payment_id  := v_payment_id
    );
  END IF;

  -- 4. Issue Invoice Document Row
  v_inv_doc := fn_issue_document(
    p_type        := 'INVOICE',
    p_customer_id := v_customer_id,
    p_sale_id     := v_sale_id
  );

  -- 5. Return Complete Consolidated Payload
  RETURN jsonb_build_object(
    'customer_id',     v_customer_id,
    'customer_number', v_customer_number,
    'sale_id',         v_sale_id,
    'sale_number',     v_sale_number,
    'total_amount',    v_total_amount,
    'payment_id',      v_payment_id,
    'payment_number',  v_payment_number,
    'invoice_id',      v_inv_doc.id,
    'invoice_number',  v_inv_doc.document_number,
    'receipt_id',      v_rcp_doc.id,
    'receipt_number',  v_rcp_doc.document_number
  );
END; $$;

REVOKE EXECUTE ON FUNCTION fn_create_sale_full(JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_create_sale_full(JSONB, JSONB, JSONB, JSONB) TO authenticated;
