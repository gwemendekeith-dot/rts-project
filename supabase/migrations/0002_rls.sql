-- ============================================================
-- RAFIKI OPERATIONS DESK — 0002_rls.sql
-- Role model + Row-Level Security. No DELETE policies anywhere.
-- Apply order: 2 of 4 (after schema).
-- ============================================================

-- ---------- Role lookup (reads switchable active_role) ----------
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT active_role FROM profiles WHERE id = auth.uid();
$$;

-- ---------- Role switcher ----------
CREATE OR REPLACE FUNCTION fn_switch_role(p_role TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_holds BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM user_roles
                 WHERE user_id = auth.uid() AND role = p_role) INTO v_holds;
  IF NOT v_holds THEN RAISE EXCEPTION 'ROLE_NOT_ASSIGNED'; END IF;
  UPDATE profiles SET active_role = p_role WHERE id = auth.uid();
  INSERT INTO audit_logs (user_id, actor_role, action, entity_type, entity_id, new_values)
  VALUES (auth.uid(), current_user_role(), 'ROLE_SWITCHED', 'profiles', auth.uid(),
          jsonb_build_object('active_role', p_role));
  RETURN jsonb_build_object('active_role', p_role);
END; $$;

-- ---------- Audit actor_role auto-fill ----------
CREATE OR REPLACE FUNCTION fn_set_audit_actor_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.actor_role IS NULL THEN
    NEW.actor_role := current_user_role();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_actor_role
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_actor_role();

-- ============================================================
-- BACK-OFFICE TABLES: read for OWNER+SALES, write for OWNER only
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','serial_numbers','installers','referral_partners',
    'installations','installation_parts','warranties','warranty_terms',
    'inventory','inventory_movements','obligations','cash_movements',
    'refunds','system_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "%s_read" ON %I FOR SELECT
         USING (current_user_role() IN (''OWNER'',''SALES''))', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT
         WITH CHECK (current_user_role() = ''OWNER'')', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE
         USING (current_user_role() = ''OWNER'')', t, t);
  END LOOP;
END $$;

-- ============================================================
-- FRONT-OFFICE TABLES: OWNER+SALES can read & write
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','enquiries','quotes','quote_items','sales','sale_items','payments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "%s_read" ON %I FOR SELECT
         USING (current_user_role() IN (''OWNER'',''SALES''))', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT
         WITH CHECK (current_user_role() IN (''OWNER'',''SALES''))', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE
         USING (current_user_role() IN (''OWNER'',''SALES''))', t, t);
  END LOOP;
END $$;

-- ============================================================
-- DOCUMENTS: both issue, only OWNER voids/modifies
-- ============================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_read   ON documents FOR SELECT
  USING (current_user_role() IN ('OWNER','SALES'));
CREATE POLICY documents_insert ON documents FOR INSERT
  WITH CHECK (current_user_role() IN ('OWNER','SALES'));
CREATE POLICY documents_update ON documents FOR UPDATE
  USING (current_user_role() = 'OWNER');

-- ============================================================
-- AUDIT LOGS: OWNER read-only; no direct writes by anyone
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_logs FOR SELECT
  USING (current_user_role() = 'OWNER');
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon, authenticated;

-- ============================================================
-- PROFILES & USER_ROLES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read_self ON profiles FOR SELECT
  USING (id = auth.uid() OR current_user_role() = 'OWNER');
CREATE POLICY profiles_owner_write ON profiles FOR ALL
  USING (current_user_role() = 'OWNER');

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_read_self ON user_roles FOR SELECT
  USING (user_id = auth.uid() OR current_user_role() = 'OWNER');
CREATE POLICY user_roles_owner_write ON user_roles FOR ALL
  USING (current_user_role() = 'OWNER');
