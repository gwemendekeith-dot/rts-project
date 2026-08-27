-- ============================================================
-- RAFIKI OPERATIONS DESK — 0001_schema.sql
-- Core schema: extensions, sequences, numbering, all 24 tables.
-- Apply order: 1 of 4.
-- ============================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------- Sequences ----------
-- Document sequences (type-prefixed numbering)
CREATE SEQUENCE IF NOT EXISTS seq_quote                   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_invoice                 START 1;
CREATE SEQUENCE IF NOT EXISTS seq_receipt                 START 1;
CREATE SEQUENCE IF NOT EXISTS seq_warranty_certificate    START 1;
CREATE SEQUENCE IF NOT EXISTS seq_installation_report     START 1;
-- Entity sequences
CREATE SEQUENCE IF NOT EXISTS seq_customer   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_enquiry    START 1;
CREATE SEQUENCE IF NOT EXISTS seq_sale       START 1;
CREATE SEQUENCE IF NOT EXISTS seq_payment    START 1;
CREATE SEQUENCE IF NOT EXISTS seq_job        START 1;
CREATE SEQUENCE IF NOT EXISTS seq_warranty   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_refund     START 1;

-- ---------- Numbering helper ----------
-- Produces PREFIX + YYYY + '-' + zero-padded 4-digit sequence.
CREATE OR REPLACE FUNCTION fn_next_number(p_prefix TEXT, p_seq TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN p_prefix || to_char(now(),'YYYY') || '-' || lpad(nextval(p_seq)::TEXT, 4, '0');
END; $$;

-- ============================================================
-- CONFIG & TERMS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  value_type   TEXT DEFAULT 'string',
  updated_by   UUID,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warranty_terms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version          TEXT NOT NULL UNIQUE,
  clause_warranty  TEXT NOT NULL,
  clause_liability TEXT NOT NULL,
  clause_returns   TEXT NOT NULL,
  clause_handover  TEXT NOT NULL,
  effective_date   DATE NOT NULL,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PEOPLE & ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  active_role TEXT NOT NULL DEFAULT 'OWNER'
              CHECK (active_role IN ('OWNER','SALES','OPERATIONS')),
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('OWNER','SALES','OPERATIONS')),
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number TEXT NOT NULL UNIQUE,
  customer_type   TEXT DEFAULT 'RESIDENTIAL'
                  CHECK (customer_type IN ('RESIDENTIAL','COMMERCIAL')),
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  business_name   TEXT,
  phone           TEXT NOT NULL,
  email           TEXT,
  address         TEXT,
  city            TEXT DEFAULT 'Harare',
  referral_source TEXT,
  notes           TEXT,
  status          TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_number  TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  company_name      TEXT,
  phone             TEXT NOT NULL,
  email             TEXT,
  rate_per_install  NUMERIC(10,2) DEFAULT 50.00,
  agreement_on_file BOOLEAN DEFAULT false,
  is_backup         BOOLEAN DEFAULT false,
  status            TEXT DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_number  TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  phone           TEXT,
  partner_type    TEXT CHECK (partner_type IN
                    ('HARDWARE_STORE','PLUMBER','ELECTRICIAN','OTHER')),
  commission_type TEXT DEFAULT 'FLAT' CHECK (commission_type IN ('FLAT','PERCENT')),
  commission_rate NUMERIC(10,2) DEFAULT 10.00,
  status          TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CATALOGUE
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                   TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('UNIT','SERVICE','PART')),
  model                 TEXT,
  description           TEXT,
  cost_price            NUMERIC(10,2),
  selling_price         NUMERIC(10,2) NOT NULL,
  warranty_months       INT DEFAULT 6,
  requires_serial       BOOLEAN DEFAULT false,
  requires_installation BOOLEAN DEFAULT false,
  active                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS serial_numbers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number       TEXT NOT NULL UNIQUE,
  product_id          UUID NOT NULL REFERENCES products(id),
  status              TEXT NOT NULL DEFAULT 'AVAILABLE'
                      CHECK (status IN ('AVAILABLE','RESERVED','ALLOCATED',
                                        'INSTALLED','RETURNED','DAMAGED','SCRAPPED')),
  received_date       DATE,
  receiving_photo_ref TEXT,
  qc_status           TEXT CHECK (qc_status IN ('PASS','FAIL','PENDING')),
  qc_notes            TEXT,
  sale_id             UUID,          -- FK added below after sales table exists
  customer_id         UUID REFERENCES customers(id),
  installation_id     UUID,          -- FK added below after installations table exists
  sold_date           DATE,
  installed_date      DATE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COMMERCIAL INTAKE
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_number   TEXT NOT NULL UNIQUE,
  customer_id      UUID NOT NULL REFERENCES customers(id),
  source           TEXT NOT NULL CHECK (source IN
                     ('WHATSAPP','FACEBOOK','INSTAGRAM','WEBSITE','PHONE',
                      'WALK_IN','REFERRAL','WAITLIST','EXISTING_CUSTOMER','OTHER')),
  product_interest UUID REFERENCES products(id),
  message          TEXT,
  status           TEXT NOT NULL DEFAULT 'NEW'
                   CHECK (status IN ('NEW','CONTACTED','QUALIFIED',
                                     'QUOTE_REQUESTED','CONVERTED','LOST','CLOSED')),
  assigned_to      UUID,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  customer_id  UUID NOT NULL REFERENCES customers(id),
  enquiry_id   UUID REFERENCES enquiries(id),
  quote_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until  DATE,
  subtotal     NUMERIC(10,2) DEFAULT 0,
  discount     NUMERIC(10,2) DEFAULT 0,
  total        NUMERIC(10,2) DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'DRAFT'
               CHECK (status IN ('DRAFT','SENT','VIEWED','ACCEPTED','DECLINED',
                                 'EXPIRED','CANCELLED','CONVERTED')),
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  discount    NUMERIC(10,2) DEFAULT 0,
  line_total  NUMERIC(10,2) GENERATED ALWAYS AS
              (quantity * unit_price - discount) STORED
);

-- ============================================================
-- SALES ENGINE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number         TEXT NOT NULL UNIQUE,
  customer_id         UUID NOT NULL REFERENCES customers(id),
  quote_id            UUID REFERENCES quotes(id),
  referral_partner_id UUID REFERENCES referral_partners(id),
  referral_source     TEXT,
  sale_date           TIMESTAMPTZ DEFAULT now(),
  subtotal            NUMERIC(10,2) DEFAULT 0,
  discount            NUMERIC(10,2) DEFAULT 0,
  total_amount        NUMERIC(10,2) DEFAULT 0,
  amount_paid         NUMERIC(10,2) DEFAULT 0,
  balance_due         NUMERIC(10,2) DEFAULT 0,
  payment_status      TEXT NOT NULL DEFAULT 'UNPAID'
                      CHECK (payment_status IN ('UNPAID','PARTIAL','PAID',
                                                'OVERPAID','REFUND_DUE','REFUNDED',
                                                'PARTIALLY_REFUNDED')),
  fulfilment_status   TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (fulfilment_status IN ('PENDING','SCHEDULED','INSTALLED',
                                                   'COMPLETED','CANCELLED')),
  is_preorder         BOOLEAN DEFAULT false,
  notes               TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  description      TEXT NOT NULL,
  quantity         INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       NUMERIC(10,2) NOT NULL,
  discount         NUMERIC(10,2) DEFAULT 0,
  line_total       NUMERIC(10,2) GENERATED ALWAYS AS
                   (quantity * unit_price - discount) STORED,
  serial_number_id UUID REFERENCES serial_numbers(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number    TEXT NOT NULL UNIQUE,
  sale_id           UUID NOT NULL REFERENCES sales(id),
  customer_id       UUID NOT NULL REFERENCES customers(id),
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency          TEXT DEFAULT 'USD',
  payment_method    TEXT NOT NULL CHECK (payment_method IN
                      ('CASH','ECOCASH','BANK_TRANSFER','CARD','OTHER')),
  payment_reference TEXT,
  payment_date      TIMESTAMPTZ DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'CONFIRMED'
                    CHECK (status IN ('PENDING','CONFIRMED','FAILED','REVERSED',
                                      'REFUNDED','PARTIALLY_REFUNDED')),
  received_by       UUID,
  notes             TEXT
);

CREATE TABLE IF NOT EXISTS refunds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number TEXT NOT NULL UNIQUE,
  payment_id    UUID NOT NULL REFERENCES payments(id),
  sale_id       UUID NOT NULL REFERENCES sales(id),
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method        TEXT,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED')),
  processed_by  UUID,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FULFILMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS installations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number              TEXT NOT NULL UNIQUE,
  sale_id                 UUID NOT NULL REFERENCES sales(id),
  customer_id             UUID NOT NULL REFERENCES customers(id),
  serial_number_id        UUID NOT NULL REFERENCES serial_numbers(id),
  installer_id            UUID REFERENCES installers(id),
  address                 TEXT NOT NULL,
  scheduled_date          DATE,
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','SCHEDULED','ASSIGNED','IN_PROGRESS',
                                            'TESTING','INSTALLED','COMPLETED','RESCHEDULED',
                                            'CANCELLED','REWORK_REQUIRED')),
  parts_needed            TEXT,
  gas_test                BOOLEAN DEFAULT false,
  water_test              BOOLEAN DEFAULT false,
  unit_test               BOOLEAN DEFAULT false,
  customer_handover       BOOLEAN DEFAULT false,
  customer_signature      TEXT,
  photo_refs              TEXT[],
  installer_payout_due    NUMERIC(10,2) DEFAULT 0,
  installer_payout_status TEXT DEFAULT 'UNPAID'
                          CHECK (installer_payout_status IN ('UNPAID','PAID')),
  installer_notes         TEXT,
  customer_notes          TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installation_parts (
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes           TEXT,
  PRIMARY KEY (installation_id, product_id)
);

CREATE TABLE IF NOT EXISTS warranties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_number  TEXT NOT NULL UNIQUE,
  serial_number_id UUID NOT NULL UNIQUE REFERENCES serial_numbers(id),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  sale_id          UUID NOT NULL REFERENCES sales(id),
  installation_id  UUID NOT NULL UNIQUE REFERENCES installations(id),
  terms_version    TEXT NOT NULL DEFAULT 'v1.0-2026',
  start_date       DATE,
  duration_months  INT NOT NULL DEFAULT 6,
  expiry_date      DATE,
  status           TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','ACTIVE','EXPIRED','VOID','CLAIMED','CLOSED')),
  service_notes    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL UNIQUE REFERENCES products(id),
  quantity_on_hand      INT NOT NULL DEFAULT 0,
  quantity_reserved     INT NOT NULL DEFAULT 0,
  quantity_available    INT GENERATED ALWAYS AS
                        (quantity_on_hand - quantity_reserved) STORED,
  reorder_level         INT,
  reorder_backstop_date DATE,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id),
  serial_number_id UUID REFERENCES serial_numbers(id),
  movement_type    TEXT NOT NULL CHECK (movement_type IN
                     ('OPENING_STOCK','PURCHASE','SALE','RESERVATION','RELEASE',
                      'RETURN','DAMAGE','ADJUSTMENT','TRANSFER','CONSUMED')),
  quantity         INT NOT NULL,
  reference_type   TEXT,
  reference_id     UUID,
  movement_date    TIMESTAMPTZ DEFAULT now(),
  notes            TEXT,
  created_by       UUID NOT NULL,
  UNIQUE (serial_number_id, movement_type, reference_id)
);

-- ============================================================
-- FINANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS obligations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_number TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL,
  total_amount      NUMERIC(12,2) NOT NULL,
  amount_paid       NUMERIC(12,2) DEFAULT 0,
  due_date          DATE,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PARTIAL','SETTLED')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN
                  ('CAPITAL','SUPPLIER_PAYMENT','CUSTOMER_REVENUE','FREIGHT_DUTY',
                   'EXPENSE','REFUND','INSTALLER_PAYOUT','COMMISSION','OTHER')),
  type          TEXT NOT NULL CHECK (type IN ('IN','OUT')),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  source_type   TEXT CHECK (source_type IN ('PAYMENT','OBLIGATION','REFUND','MANUAL')),
  source_id     UUID,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENTS & AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number  TEXT NOT NULL UNIQUE,
  document_type    TEXT NOT NULL CHECK (document_type IN
                     ('QUOTE','INVOICE','RECEIPT','WARRANTY_CERTIFICATE','INSTALLATION_REPORT')),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  sale_id          UUID REFERENCES sales(id),
  payment_id       UUID REFERENCES payments(id),
  quote_id         UUID REFERENCES quotes(id),
  installation_id  UUID REFERENCES installations(id),
  warranty_id      UUID REFERENCES warranties(id),
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT','ISSUED','VOID')),
  template_version TEXT NOT NULL,
  file_reference   TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  reason      TEXT,
  ip_address  INET,
  timestamp   TIMESTAMPTZ DEFAULT now()
);

-- ---------- Deferred foreign keys (circular refs) ----------
ALTER TABLE serial_numbers
  ADD CONSTRAINT fk_serial_sale
  FOREIGN KEY (sale_id) REFERENCES sales(id);
ALTER TABLE serial_numbers
  ADD CONSTRAINT fk_serial_installation
  FOREIGN KEY (installation_id) REFERENCES installations(id);

-- ---------- Document cardinality rules ----------
ALTER TABLE documents ADD CONSTRAINT chk_invoice CHECK
  (document_type <> 'INVOICE' OR sale_id IS NOT NULL);
ALTER TABLE documents ADD CONSTRAINT chk_receipt CHECK
  (document_type <> 'RECEIPT' OR payment_id IS NOT NULL);
ALTER TABLE documents ADD CONSTRAINT chk_wtycert CHECK
  (document_type <> 'WARRANTY_CERTIFICATE' OR warranty_id IS NOT NULL);
ALTER TABLE documents ADD CONSTRAINT chk_insrep CHECK
  (document_type <> 'INSTALLATION_REPORT' OR installation_id IS NOT NULL);
ALTER TABLE documents ADD CONSTRAINT chk_quote CHECK
  (document_type <> 'QUOTE' OR quote_id IS NOT NULL);
