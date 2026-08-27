-- ============================================================
-- RAFIKI OPERATIONS DESK — 0004_views_seed.sql
-- Dashboard views + locked seed data.
-- Apply order: 4 of 4 (after schema, RLS, functions).
-- ============================================================

-- ---------- View: cash running balance ----------
CREATE OR REPLACE VIEW v_cash_position AS
SELECT *,
  SUM(CASE WHEN type='IN' THEN amount ELSE -amount END)
    OVER (ORDER BY movement_date, created_at) AS running_balance
FROM cash_movements;

-- ---------- View: stock dashboard with days-of-stock ----------
CREATE OR REPLACE VIEW v_stock_dashboard AS
SELECT
  p.sku, p.name,
  i.quantity_on_hand, i.quantity_reserved, i.quantity_available,
  CASE
    WHEN COALESCE(sold.units_sold_28d, 0) = 0 THEN NULL
    ELSE ROUND(i.quantity_available / (sold.units_sold_28d / 28.0), 1)
  END AS days_of_stock_remaining,
  CASE
    WHEN COALESCE(sold.units_sold_28d, 0) = 0 THEN 'NO_SALES_YET'
    WHEN i.quantity_available / (sold.units_sold_28d / 28.0) <= 30 THEN 'REORDER_NOW'
    ELSE 'OK'
  END AS restock_status
FROM inventory i
JOIN products p ON p.id = i.product_id
LEFT JOIN (
  SELECT si.product_id, SUM(si.quantity) AS units_sold_28d
  FROM sale_items si JOIN sales s ON s.id = si.sale_id
  WHERE s.sale_date >= now() - INTERVAL '28 days'
  GROUP BY si.product_id
) sold ON sold.product_id = i.product_id;

-- ---------- View: 6-stage tracker pipeline ----------
CREATE OR REPLACE VIEW v_pipeline_summary AS
SELECT 'Enquiry' AS stage, COUNT(*) FROM enquiries
  WHERE status NOT IN ('CONVERTED','LOST','CLOSED')
UNION ALL SELECT 'Quoted', COUNT(*) FROM quotes
  WHERE status IN ('SENT','VIEWED','ACCEPTED')
UNION ALL SELECT 'Deposit Paid', COUNT(*) FROM sales
  WHERE payment_status IN ('PARTIAL','PAID') AND fulfilment_status='PENDING'
UNION ALL SELECT 'Scheduled', COUNT(*) FROM sales
  WHERE fulfilment_status='SCHEDULED'
UNION ALL SELECT 'Installed', COUNT(*) FROM sales
  WHERE fulfilment_status IN ('INSTALLED','COMPLETED')
UNION ALL SELECT 'Warranty Registered', COUNT(*) FROM warranties
  WHERE status='ACTIVE';

-- ============================================================
-- SEED DATA
-- ============================================================

-- ---------- System settings (locked decisions) ----------
INSERT INTO system_settings (key, value, value_type) VALUES
  ('company_legal_name',       'Rafiki Thermal Solutions', 'string'),
  ('tagline',                  'Hot Water on The Go, Smart Living', 'string'),
  ('location',                 'Harare, Zimbabwe', 'string'),
  ('whatsapp_number',          '+263 71 466 9128', 'string'),
  ('ecocash_enabled',          'false', 'bool'),
  ('currency',                 'USD', 'string'),
  ('vat_registered',           'false', 'bool'),
  ('reorder_threshold_days',   '30', 'int'),
  ('warranty_default_months',  '6', 'int'),
  ('installer_fee',            '50.00', 'decimal'),
  ('company_install_cut',      '20.00', 'decimal'),
  ('referral_commission_flat', '10.00', 'decimal'),
  ('investor_option',          'A', 'string'),
  ('quote_validity_days',      '14', 'int')
ON CONFLICT (key) DO NOTHING;

-- ---------- Warranty terms (canonical v1.0 from receipt) ----------
INSERT INTO warranty_terms
  (version, clause_warranty, clause_liability, clause_returns, clause_handover,
   effective_date, is_active)
VALUES (
  'v1.0-2026',
  'This unit is covered by a 6-month Rafiki Thermal Solutions warranty from the date of installation, covering manufacturing defects only. The warranty is void if the unit is tampered with, altered, or repaired/serviced by any person not authorized by Rafiki Thermal Solutions, or if it is damaged through misuse, incorrect installation by third parties, or use outside the manufacturer''s specifications. Retain this receipt as proof of purchase; it is required for any warranty claim.',
  'Installation was carried out in line with standard gas safety practice. Rafiki Thermal Solutions accepts no liability for damage, injury, or malfunction arising from unauthorized modification, relocation, or servicing of the unit after handover, or from third-party plumbing, gas, or electrical work not performed by Rafiki Thermal Solutions or its appointed technicians.',
  'Given the nature of installed gas appliances, this sale is final; no refunds or exchanges are offered once the unit has been installed and tested, except where the warranty in Clause 1 applies.',
  'By accepting this receipt, the customer confirms the unit was inspected, tested, and found to be in good working order at the time of installation.',
  '2026-08-26', true
) ON CONFLICT (version) DO NOTHING;

-- ---------- Products (working prices + landed cost for margins) ----------
INSERT INTO products (sku, name, category, description, cost_price, selling_price,
                      warranty_months, requires_serial, requires_installation) VALUES
  ('GH-12L',      '12L Gas Geyser',               'UNIT',    '12L Gas Geyser (Outdoor)', 98.71,  150.00, 6, true,  true),
  ('GH-16L',      '16L Gas Geyser',               'UNIT',    '16L Gas Geyser (Outdoor)', 132.53, 220.00, 6, true,  true),
  ('GH-20L',      '20L Gas Geyser',               'UNIT',    '20L Gas Geyser (Outdoor)', 166.62, 280.00, 6, true,  true),
  ('SVC-INSTALL', 'Installation Labor',           'SERVICE', 'Professional installation', NULL, 70.00, 0, false, false),
  ('SVC-PARTS',   'Installation Parts & Fittings','SERVICE', 'Install parts at cost',     NULL,  0.00, 0, false, false),
  ('PART-VALVE',  'Zero-pressure gas valve',      'PART',    'Spare part',                NULL,  0.00, 0, false, false),
  ('PART-IGN',    'Pulse ignition box',           'PART',    'Spare part',                NULL,  0.00, 0, false, false),
  ('PART-BATT',   'Battery box',                  'PART',    'Spare part',                NULL,  0.00, 0, false, false)
ON CONFLICT (sku) DO NOTHING;

-- ---------- Obligations (confirmed capital structure) ----------
INSERT INTO obligations (obligation_number, description, total_amount, due_date, status) VALUES
  ('RTS-OBL-001', 'Factory balance (70% of $2,915)',     2040.50, '2026-09-25', 'PENDING'),
  ('RTS-OBL-002', 'Freight/duty/VAT instalment',         1494.00, '2026-10-26', 'PENDING'),
  ('RTS-OBL-003', 'Investor return Option A (M6 & M12)', 1151.00, '2027-02-26', 'PENDING')
ON CONFLICT (obligation_number) DO NOTHING;

-- ---------- Opening cash ledger (KEITH-CONFIRMED $874.50 deposit) ----------
INSERT INTO cash_movements (movement_date, description, category, type, amount, source_type) VALUES
  ('2026-08-26', 'Capital base deployed', 'CAPITAL', 'IN', 4409.00, 'MANUAL'),
  ('2026-08-26', 'Production deposit paid to factory (30% of $2,915)', 'SUPPLIER_PAYMENT', 'OUT', 874.50, 'MANUAL');

-- ---------- Inventory placeholders for the three units ----------
INSERT INTO inventory (product_id, quantity_on_hand)
SELECT id, 0 FROM products WHERE category='UNIT'
ON CONFLICT (product_id) DO NOTHING;

-- ---------- Installer placeholder (name TBD — tracker example is illustrative) ----------
INSERT INTO installers (installer_number, name, phone, rate_per_install, status)
VALUES ('RTS-INS-001', 'TBC — primary plumber', 'TBC', 50.00, 'ACTIVE')
ON CONFLICT (installer_number) DO NOTHING;
