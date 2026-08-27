# PHASE 11: DATABASE INTEGRITY AUDIT

**Audit Date**: 2026-08-27  
**Scope**: Foreign keys, constraints, nullable fields, indexes, orphan detection, data anomalies  
**Status**: COMPLETE — 11 findings identified (0 P0, 2 P1, 4 P2, 5 P3)

---

## EXECUTIVE SUMMARY

The database schema in `0001_schema.sql` is **well-designed with strong structural integrity**. All 24 tables have appropriate foreign key constraints, CHECK constraints, and generated columns where needed.

**Critical Issues Found**: 0  
**High-Priority Issues**: 2  
**Medium-Priority Issues**: 4  
**Low-Priority Issues**: 5  

---

## DETAILED FINDINGS

### ✅ STRENGTHS VERIFIED

1. **Foreign Key Integrity**: All 24 tables properly linked
2. **Deferred FKs**: Circular references (serial_numbers.sale_id/installation_id) correctly handled
3. **Cascade Deletes**: Properly scoped (e.g., quote_items ON DELETE CASCADE)
4. **Check Constraints**: Comprehensive (enums, positive amounts, status values)
5. **Unique Constraints**: Applied to business identifiers (sale_number, serial_number, etc.)
6. **Generated Columns**: Correctly used for computed values (quantity_available, line_total)

---

## HIGH-PRIORITY (P1) FINDINGS

### [P1-1] FOUND: Warranty UNIQUE Constraints Too Strict

**Location**: `0001_schema.sql`, lines 337, 340

```sql
CREATE TABLE warranties (
  ...
  serial_number_id UUID NOT NULL UNIQUE REFERENCES serial_numbers(id),
  ...
  installation_id  UUID NOT NULL UNIQUE REFERENCES installations(id),
  ...
);
```

**Issue**: Both `serial_number_id` and `installation_id` are marked UNIQUE.

**Problem**: 
- One-to-one relationship enforced at database level
- If a serial number's warranty is VOIDED and a new one issued, this constraint blocks it
- Prevents legitimate warranty replacement (voided → new) scenario
- Edge case: Serial returned post-installation (RETURNED status), then re-issued

**Impact**: HIGH — Warranty lifecycle may be blocked by constraint violation

**Recommended Fix**:
- Remove UNIQUE constraint from one or both columns
- Use database trigger to enforce: "Only one ACTIVE warranty per serial" if needed
- OR: Allow multiple warranties per serial with status-based filtering

**Status**: IDENTIFIED — Awaiting business logic clarification

**Action**: [DECISION REQUIRED — KEITH]
- Should a physical serial number have only one warranty record (current)?
- Or can we issue replacement warranties (PENDING → ACTIVE sequence) per serial?

---

### [P1-2] FOUND: Audit Logs user_id Not Nullable But Allows NULL

**Location**: `0001_schema.sql`, line 437

```sql
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  actor_role  TEXT,
  ...
);
```

**Issue**: Column defined `NOT NULL` but in `0009_critical_remediation.sql` we insert with `user_id=NULL`:

```sql
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
VALUES (NULL, 'CRON_SCHEDULE_FAILED', 'system', NULL, ...);
```

**Problem**:
- Schema constraint violated by application logic
- System events (cron failures, migrations) cannot be logged
- Future auditors will miss system-level events

**Impact**: HIGH — Audit trail incomplete for non-user actions

**Recommended Fix**: Make `user_id` nullable in schema
```sql
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;
```

**Status**: IDENTIFIED — Needs schema update

---

## MEDIUM-PRIORITY (P2) FINDINGS

### [P2-1] FOUND: Installer May Not Exist for Installation

**Location**: `0001_schema.sql`, line 301

```sql
CREATE TABLE installations (
  ...
  installer_id            UUID REFERENCES installers(id),
  ...
);
```

**Issue**: `installer_id` is nullable (no `NOT NULL`), but `0009_critical_remediation.sql` and earlier code assume installer exists.

**Problem**:
- Installation can be created without installer assignment
- Completion function assumes installer_id populated for payout
- When completing job without installer, `v_fee` snapshots but no installer to pay
- Cleanup logic needed for abandoned/unassigned jobs

**Impact**: MEDIUM — Orphaned installations without installers

**Recommended Fix**:
```sql
-- Add NOT NULL constraint after ensuring all existing installations have installer_id
ALTER TABLE installations ALTER COLUMN installer_id SET NOT NULL;
```

**Alternative**: Document workflow:
- PENDING → SCHEDULED (still may not have installer)
- SCHEDULED → must assign installer before completion

**Status**: IDENTIFIED — Needs clarification or schema update

---

### [P2-2] FOUND: Serial QC Status May Be NULL

**Location**: `0001_schema.sql`, line 155

```sql
CREATE TABLE serial_numbers (
  ...
  qc_status           TEXT CHECK (qc_status IN ('PASS','FAIL','PENDING')),
  ...
);
```

**Issue**: `qc_status` is nullable by default. But `0009_critical_remediation.sql` checks:
```sql
IF v_serial_qc <> 'PASS' THEN RAISE EXCEPTION 'SERIAL_QC_FAILED';
```

**Problem**:
- Serial received with NULL qc_status (QC not yet done)
- Comparison: NULL <> 'PASS' evaluates to NULL (unknown), not true/false
- Exception may not trigger correctly
- Serial slips through QC gate

**Impact**: MEDIUM — QC enforcement broken for NULL status

**Recommended Fix**:
```sql
-- Update logic to handle NULL explicitly
IF COALESCE(v_serial_qc, 'PENDING') <> 'PASS' THEN ...

-- Or make qc_status NOT NULL with default 'PENDING'
ALTER TABLE serial_numbers ALTER COLUMN qc_status SET NOT NULL DEFAULT 'PENDING';
```

**Status**: IDENTIFIED — Needs immediate fix to 0009

---

### [P2-3] FOUND: Missing Indexes on Foreign Keys

**Location**: `0001_schema.sql` (no explicit indexes shown)

**Issue**: Foreign key columns lack indexes for common queries.

**Columns Without Visible Index**:
- `sale_items.sale_id` — queried often for line-item lookups
- `payments.sale_id` — queried for payment history
- `installations.sale_id` — queried for job scheduling
- `warranty.customer_id` — queried for warranty history per customer
- `serial_numbers.customer_id` — queried for customer asset list

**Impact**: MEDIUM — Query performance on high-volume tables

**Recommended Fix**: Create composite indexes
```sql
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_payments_sale_id ON payments(sale_id);
CREATE INDEX idx_installations_sale_id ON installations(sale_id);
CREATE INDEX idx_warranties_customer_id ON warranties(customer_id);
CREATE INDEX idx_serials_customer_id ON serial_numbers(customer_id);
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
```

**Status**: IDENTIFIED — Optimization, not critical

---

### [P2-4] FOUND: Cash Movements Currency Not Tracked

**Location**: `0001_schema.sql`, lines 398-411

```sql
CREATE TABLE cash_movements (
  ...
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  ...
  -- NO currency field
);
```

**Issue**: `payments.currency` exists (line 266), but `cash_movements` assumes USD.

**Problem**:
- If customer pays in ECOCASH (ZWL equivalent), cash_movements lacks currency
- Cash position view may mix currencies incorrectly
- Balance calculation nonsensical if different currencies

**Impact**: MEDIUM — Multi-currency support unclear

**Current Status**: System is USD-only (seed data confirms)

**Recommended Fix**:
```sql
ALTER TABLE cash_movements ADD COLUMN currency TEXT DEFAULT 'USD'
  CHECK (currency IN ('USD','ZWL','ECOCASH'));
```

**Status**: IDENTIFIED — Future-proofing

---

## LOW-PRIORITY (P3) FINDINGS

### [P3-1] Missing: Customer Purchase History Index

**Issue**: No obvious index on `sales(customer_id)` for "view all sales for customer" queries.

**Fix**: Create index:
```sql
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
```

**Status**: IDENTIFIED — Performance optimization

---

### [P3-2] Missing: Enquiry Status Pipeline Index

**Issue**: `enquiries.status` often filtered; no index visible.

**Fix**:
```sql
CREATE INDEX idx_enquiries_status ON enquiries(status);
```

**Status**: IDENTIFIED — Performance optimization

---

### [P3-3] Missing: Audit Log Timestamp Index

**Issue**: Audit logs queried by time range; no timestamp index visible.

**Fix**:
```sql
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
```

**Status**: IDENTIFIED — Performance optimization

---

### [P3-4] Missing: Inventory Reorder Threshold Index

**Issue**: Dashboard queries low-stock SKUs; no index on `inventory.reorder_level`.

**Fix**:
```sql
CREATE INDEX idx_inventory_reorder ON inventory(quantity_available, reorder_level);
```

**Status**: IDENTIFIED — Performance optimization

---

### [P3-5] Schema Documentation Gap

**Issue**: No comments on tables explaining business meaning.

**Fix**: Add table comments:
```sql
COMMENT ON TABLE sales IS 'Core transactional record: product sale, payment obligation, fulfillment tracking';
COMMENT ON TABLE serial_numbers IS 'Physical asset tracking: uniqueness guarantee for serialized products';
COMMENT ON TABLE warranties IS 'Post-installation service agreements: one active per serial (customer claim gate)';
```

**Status**: IDENTIFIED — Documentation only

---

## ORPHAN RECORD DETECTION

### Query: Orphaned Sale Items (Products Deleted)
```sql
SELECT si.id, si.sale_id, si.product_id
FROM sale_items si
LEFT JOIN products p ON si.product_id = p.id
WHERE p.id IS NULL;
-- Expected: 0 rows (FK constraint prevents)
```

**Status**: ✅ Cannot occur (FK enforced)

---

### Query: Orphaned Serial Numbers (Product Deleted)
```sql
SELECT s.id, s.serial_number, s.product_id
FROM serial_numbers s
LEFT JOIN products p ON s.product_id = p.id
WHERE p.id IS NULL;
-- Expected: 0 rows (FK enforced)
```

**Status**: ✅ Cannot occur (FK enforced)

---

### Query: Orphaned Installations (Sale Deleted)
```sql
SELECT i.id, i.job_number, i.sale_id
FROM installations i
LEFT JOIN sales s ON i.sale_id = s.id
WHERE s.id IS NULL;
-- Expected: 0 rows (FK enforced)
```

**Status**: ✅ Cannot occur (FK enforced)

---

### Query: Orphaned Payments (Sale Deleted)
```sql
SELECT p.id, p.payment_number, p.sale_id
FROM payments p
LEFT JOIN sales s ON p.sale_id = s.id
WHERE s.id IS NULL;
-- Expected: 0 rows (FK enforced)
```

**Status**: ✅ Cannot occur (FK enforced)

---

## NULLABLE FIELD AUDIT

| Table | Column | Nullable | Business Impact | Status |
|-------|--------|----------|-----------------|--------|
| customers | address | YES | Optional; OK | ✅ |
| customers | email | YES | Optional; OK | ✅ |
| customers | business_name | YES | Only for COMMERCIAL; OK | ✅ |
| sales | quote_id | YES | Not all sales from quotes; OK | ✅ |
| sales | referral_partner_id | YES | Optional referral; OK | ✅ |
| sale_items | discount | YES | Optional; OK | ✅ |
| payments | payment_reference | YES | **PROBLEM**: Idempotency breaks if NULL | ⚠️ |
| installations | installer_id | YES | **PROBLEM**: Should be NOT NULL | ⚠️ |
| serial_numbers | qc_status | YES | **PROBLEM**: Should default to PENDING | ⚠️ |
| serial_numbers | customer_id | YES | OK until RESERVED | ✅ |
| serial_numbers | installation_id | YES | OK until INSTALLED | ✅ |
| audit_logs | user_id | NO | **PROBLEM**: Blocks system events | ⚠️ |

**Summary**: 4 nullable fields need attention (3 schema, 1 constraint logic)

---

## CONSTRAINT CONSISTENCY AUDIT

### CHECK Constraints: ✅ ALL PRESENT

- `products`: category IN ('UNIT','SERVICE','PART')
- `serial_numbers`: status IN (valid states)
- `sales`: payment_status IN (valid states)
- `sales`: fulfilment_status IN (valid states)
- `quote_items`: quantity > 0
- `sale_items`: quantity > 0
- `payments`: amount > 0
- `cash_movements`: amount > 0
- `installations.installer_payout_status` IN (valid states)

**Status**: ✅ Comprehensive

---

### UNIQUE Constraints: ✅ WITH WARNINGS

| Column | Constraint | Issue |
|--------|-----------|-------|
| customer_number | UNIQUE | ✅ |
| products.sku | UNIQUE | ✅ |
| serial_number | UNIQUE | ✅ |
| sale_number | UNIQUE | ✅ |
| payment_number | UNIQUE | ✅ |
| warranties.serial_number_id | UNIQUE | ⚠️ P1-1 |
| warranties.installation_id | UNIQUE | ⚠️ P1-1 |

---

### Composite Keys: ✅ CORRECT

- `user_roles(user_id, role)` — good
- `installation_parts(installation_id, product_id)` — good

---

## CASCADING DELETE SAFETY

| Table | Delete Cascade Policy | Assessment |
|-------|-------|-----------|
| quote_items | CASCADE on quotes | ✅ Correct — line items deleted with quote |
| sale_items | CASCADE on sales | ✅ Correct — line items deleted with sale |
| installation_parts | CASCADE on installations | ✅ Correct — parts deleted with job |
| user_roles | CASCADE on auth.users | ✅ Correct — roles cleaned on user deletion |
| profiles | CASCADE on auth.users | ✅ Correct — profile deleted with user |

**No Problematic Cascades**: ✅ Verified

---

## RACE CONDITION AUDIT

### Scenario: Two Operators Record Same Payment

**Table**: `payments`  
**Constraint**: `uq_payment_reference_unique` (added in 0009)  
**Outcome**: ✅ Second insert fails with UNIQUE violation

---

### Scenario: Two Operators Sell Last Serial

**Table**: `serial_numbers`  
**FK**: References `products`, status checked in `fn_record_payment()`  
**Outcome**: ✅ Second payment attempt fails — serial already RESERVED

---

### Scenario: Concurrent Inventory Calculation

**Table**: `inventory` (calculated from `serial_numbers.status`)  
**Function**: `fn_refresh_inventory()` uses SELECT ... COUNT  
**Risk**: ⚠️ Between SELECT and UPDATE, inventory can change

**Assessment**: MEDIUM — inventory not locked during recalculation

**Mitigation**: For serialized products, truth is in serial_numbers, not inventory table

---

## FINANCIAL DATA INTEGRITY

### Decimal Precision Check

```sql
-- sales.total_amount: NUMERIC(10,2) → max $99,999.99
-- payments.amount: NUMERIC(10,2) → max $99,999.99
-- obligations.total_amount: NUMERIC(12,2) → max $9,999,999.99 ✅
-- cash_movements.amount: NUMERIC(12,2) ✅
```

**Status**: ✅ Sufficient for current business scale

---

### Balance Tracking

```sql
-- sales.amount_paid: NUMERIC(10,2)
-- sales.balance_due: NUMERIC(10,2)
-- Calculated as: balance_due = total_amount - amount_paid
-- No stored redundant balance — GOOD
```

**Status**: ✅ Single source of truth

---

## AUDIT LOG INTEGRITY

**Current State** (after 0009):
- user_id: NOT NULL — but we need NULL for system events
- actor_role: TEXT — auto-filled by trigger
- old_values / new_values: JSONB — flexible, correct
- timestamp: TIMESTAMPTZ — good for ordering
- reason: TEXT — captures context

**P1-2 Fix Needed**: Allow NULL user_id for system events

---

## DATA MODEL CONSISTENCY

### Sales Lifecycle Path

```
sales (UNPAID/PENDING)
  ↓ payment recorded
sales (PARTIAL/PENDING)
  ↓ installation scheduled
sales (PARTIAL/SCHEDULED)
  ↓ payment completed
sales (PAID/SCHEDULED)
  ↓ installation completed
sales (PAID/INSTALLED)
```

**Status**: ✅ Dual-axis tracking (payment + fulfillment) correct

---

### Serial Lifecycle Path

```
AVAILABLE → RESERVED → ALLOCATED → INSTALLED
    ↓                      ↓           ↓
  DAMAGED                DAMAGED    RETURNED
    ↓
  SCRAPPED
```

**Status**: ✅ Correct state machine (enforced in application, not DB)

---

## SUMMARY OF REQUIRED ACTIONS

### P1 (High Priority)

1. **Fix audit_logs.user_id NOT NULL Constraint**
   - Issue: System events cannot be logged (cron failures, migrations)
   - SQL: `ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;`
   - Test: Insert audit_log with user_id=NULL

2. **Review Warranty UNIQUE Constraints**
   - Issue: Cannot re-issue warranty if original voided
   - Options:
     a) Remove UNIQUE, allow multiple per serial, filter by status
     b) Add surrogate key to enforce "only one ACTIVE per serial"
   - Decision Required: [KEITH]

### P2 (Medium Priority)

3. **Handle NULL qc_status in 0009 Functions**
   - Add: `IF COALESCE(v_serial_qc, 'PENDING') <> 'PASS' THEN ...`
   - OR: Make qc_status NOT NULL DEFAULT 'PENDING' in schema

4. **Make installer_id NOT NULL After Validation**
   - First audit existing data for installations without installer
   - Then: `ALTER TABLE installations ALTER COLUMN installer_id SET NOT NULL;`

5. **Add Performance Indexes**
   - 6 indexes identified for FK columns
   - Implement in separate migration

6. **Track Currency in cash_movements**
   - Add: `ALTER TABLE cash_movements ADD COLUMN currency TEXT DEFAULT 'USD';`
   - Future-proofing

### P3 (Low Priority)

7. **Add Performance Indexes for Queries**
   - Customer history, enquiry status, audit timestamp, inventory reorder

8. **Document Schema with Comments**
   - Business purpose of each table

---

## VERDICT

**Database Schema Quality**: ★★★★☆ (4/5)

**Strengths**:
- ✅ Comprehensive FK constraints
- ✅ Well-designed CHECK constraints
- ✅ Appropriate UNIQUE constraints
- ✅ Correct generated columns
- ✅ No orphan records possible

**Issues**:
- ⚠️ 2 High-priority (audit logging, warranty constraints)
- ⚠️ 4 Medium-priority (QC NULL handling, installer nullable, indexes, currency)
- ⚠️ 5 Low-priority (optimization indexes, documentation)

**Overall Assessment**: **Schema is SOLID for production but needs 2 critical fixes before go-live.**

---

**Next Phase**: Phase 12 — API Audit (endpoints, auth, validation)

