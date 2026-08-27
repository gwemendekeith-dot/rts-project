-- ============================================================
-- RAFIKI OPERATIONS DESK — 0007_customers_and_serial_ops.sql
-- Customer creation + audited serial QC / status adjustments.
-- Apply order: after 0006.
-- ============================================================

-- ---------- Create customer (auto-numbered) ----------
CREATE OR REPLACE FUNCTION fn_create_customer(
  p_first_name      TEXT,
  p_phone           TEXT,
  p_last_name       TEXT DEFAULT NULL,
  p_email           TEXT DEFAULT NULL,
  p_address         TEXT DEFAULT NULL,
  p_city            TEXT DEFAULT 'Harare',
  p_customer_type   TEXT DEFAULT 'RESIDENTIAL',
  p_referral_source TEXT DEFAULT NULL,
  p_notes           TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID := gen_random_uuid(); v_number TEXT;
BEGIN
  IF p_first_name IS NULL OR trim(p_first_name) = '' THEN RAISE EXCEPTION 'FIRST_NAME_REQUIRED'; END IF;
  IF p_phone IS NULL OR trim(p_phone) = '' THEN RAISE EXCEPTION 'PHONE_REQUIRED'; END IF;
  v_number := fn_next_number('RTS-CUS-', 'seq_customer');
  INSERT INTO customers (id, customer_number, customer_type, first_name, last_name,
                         phone, email, address, city, referral_source, notes, status)
  VALUES (v_id, v_number, p_customer_type, trim(p_first_name), p_last_name,
          trim(p_phone), p_email, p_address, p_city, p_referral_source, p_notes, 'ACTIVE');
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'CUSTOMER_CREATED', 'customers', v_id,
          jsonb_build_object('customer_number', v_number, 'name', p_first_name));
  RETURN jsonb_build_object('customer_id', v_id, 'customer_number', v_number);
END; $$;

-- ---------- Receiving QC (owner only, audited) ----------
CREATE OR REPLACE FUNCTION fn_set_serial_qc(
  p_serial_id UUID, p_qc_status TEXT, p_photo_ref TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_serial serial_numbers%ROWTYPE;
BEGIN
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_qc_status NOT IN ('PASS','FAIL','PENDING') THEN RAISE EXCEPTION 'INVALID_QC_STATUS'; END IF;
  SELECT * INTO v_serial FROM serial_numbers WHERE id = p_serial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_NOT_FOUND'; END IF;
  UPDATE serial_numbers
     SET qc_status = p_qc_status,
         receiving_photo_ref = COALESCE(p_photo_ref, receiving_photo_ref),
         updated_at = now()
   WHERE id = p_serial_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'SERIAL_QC_SET', 'serial_numbers', p_serial_id,
          jsonb_build_object('serial', v_serial.serial_number, 'qc', p_qc_status));
  RETURN jsonb_build_object('serial_number', v_serial.serial_number, 'qc_status', p_qc_status);
END; $$;

-- ---------- Serial status adjustment (damage/scrap/release, owner only, audited) ----------
CREATE OR REPLACE FUNCTION fn_adjust_serial_status(
  p_serial_id UUID, p_status TEXT, p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_serial serial_numbers%ROWTYPE;
BEGIN
  IF current_user_role() <> 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('AVAILABLE','RESERVED','ALLOCATED','INSTALLED','RETURNED','DAMAGED','SCRAPPED')
    THEN RAISE EXCEPTION 'INVALID_SERIAL_STATUS'; END IF;
  SELECT * INTO v_serial FROM serial_numbers WHERE id = p_serial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_NOT_FOUND'; END IF;
  UPDATE serial_numbers SET status = p_status, updated_at = now() WHERE id = p_serial_id;
  PERFORM fn_refresh_inventory(v_serial.product_id);
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
  VALUES (auth.uid(), 'SERIAL_STATUS_ADJUSTED', 'serial_numbers', p_serial_id,
          jsonb_build_object('serial', v_serial.serial_number, 'from', v_serial.status, 'to', p_status),
          p_reason);
  RETURN jsonb_build_object('serial_number', v_serial.serial_number, 'status', p_status);
END; $$;
