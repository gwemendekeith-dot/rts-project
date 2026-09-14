-- ============================================================
-- RAFIKI OPERATIONS DESK — 0015_installer_required_for_schedule.sql
-- Enforce that an installer is assigned before an installation
-- can transition to SCHEDULED.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_schedule_installation(
  p_job_id UUID, p_date DATE, p_installer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job installations%ROWTYPE; v_prod UUID;
BEGIN
  PERFORM fn_require_authenticated();

  -- Business Rule (Manual Sec 8): An installation job cannot be scheduled without an installer
  IF p_installer_id IS NULL THEN
    RAISE EXCEPTION 'INSTALLER_REQUIRED'
      USING HINT = 'An installer must be selected before scheduling an installation job.';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'SCHEDULED_DATE_REQUIRED'
      USING HINT = 'A scheduled installation date must be specified.';
  END IF;

  SELECT * INTO v_job FROM installations WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;

  -- Verify installer exists and is currently active
  IF NOT EXISTS (SELECT 1 FROM installers WHERE id = p_installer_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'INSTALLER_NOT_FOUND_OR_INACTIVE';
  END IF;

  UPDATE installations SET status='SCHEDULED', scheduled_date=p_date,
         installer_id=p_installer_id, updated_at=now() WHERE id=p_job_id;
  UPDATE serial_numbers SET status='ALLOCATED', updated_at=now()
  WHERE id=v_job.serial_number_id;
  SELECT product_id INTO v_prod FROM serial_numbers WHERE id=v_job.serial_number_id;
  PERFORM fn_refresh_inventory(v_prod);
  UPDATE sales SET fulfilment_status='SCHEDULED', updated_at=now() WHERE id=v_job.sale_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), 'INSTALLATION_SCHEDULED', 'installations', p_job_id,
          jsonb_build_object('job', v_job.job_number, 'scheduled_date', p_date, 'installer_id', p_installer_id));

  RETURN jsonb_build_object('job', v_job.job_number, 'scheduled_date', p_date);
END; $$;

REVOKE EXECUTE ON FUNCTION fn_schedule_installation(UUID, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_schedule_installation(UUID, DATE, UUID) TO authenticated;
