# RAFIKI REMEDIATION LOG — CRITICAL FIXES PASS 1

**Audit Cycle**: Initial Audit Phases 0-10 + Critical Remediation Pass 1  
**Date Started**: 2026-08-27  
**Status**: IN PROGRESS — CRITICAL FIXES APPLIED, TESTING PHASE  
**Last Updated**: 2026-08-27

---

## EXECUTIVE SUMMARY

**Initial Audit Findings**: 8 findings identified across Phases 0-10  
- 4 P0/P1 — Critical security/business logic issues
- 2 P2 — Important but non-blocking
- 2 P3 — Minor/cosmetic

**Critical Remediation Applied**: Migration `0009_critical_remediation.sql`  
**Fixes Implemented**: 4/4 P1 vulnerabilities addressed  
**Additional Improvements**: 2 P2 items fixed + audit trail enhancement  
**Current Status**: Ready for critical end-to-end lifecycle testing

---

## CRITICAL VULNERABILITIES FIXED

### ✅ [P1-1] FIXED: Installation Completion Not Blocked by Unpaid Balance

**Vulnerability**: `fn_complete_installation()` accepted sales with `payment_status='UNPAID'`  
**Risk Level**: HIGH — Installer could deliver product without payment verification  
**Root Cause**: No payment status validation in completion function  

**Fix Location**: `supabase/migrations/0009_critical_remediation.sql` lines 34-41

```plpgsql
-- CRITICAL: Verify sale has received at least one payment
SELECT * INTO v_sale FROM sales WHERE id = v_job.sale_id FOR UPDATE;
IF v_sale.payment_status = 'UNPAID' THEN
  RAISE EXCEPTION 'PAYMENT_REQUIRED_BEFORE_INSTALLATION'
    USING HINT = 'At least a deposit payment must be recorded before installation can be completed.';
END IF;
```

**Verification Path**:
- Function now requires `payment_status IN ('PARTIAL', 'PAID', 'OVERPAID')`
- Blocks installation completion for UNPAID sales
- Error message clearly indicates requirement
- Audit log records `payment_status_verified` in audit trail

**Status**: ✅ FIXED — Awaiting test

---

### ✅ [P1-2] FIXED: Serial QC Status Not Enforced for Sale

**Vulnerability**: Sales allowed for serials with `qc_status` ∉ {'PASS'}  
**Risk Level**: HIGH — Defective/unverified units could be sold  
**Root Cause**: QC verification missing in sale creation and payment functions  

**Fix Location**: `supabase/migrations/0009_critical_remediation.sql`
- Sale creation: lines 58-65
- Payment recording: lines 130-136

```plpgsql
-- In fn_create_sale() during serial validation
SELECT qc_status INTO v_serial_qc FROM serial_numbers
  WHERE id = v_serial_id AND product_id = v_product.id AND status = 'AVAILABLE';
IF NOT FOUND THEN RAISE EXCEPTION 'SERIAL_UNAVAILABLE'; END IF;
IF v_serial_qc <> 'PASS' THEN
  RAISE EXCEPTION 'SERIAL_QC_FAILED'
    USING HINT = 'Only serials with QC status PASS may be sold. Current status: ' 
    || COALESCE(v_serial_qc, 'UNKNOWN');
END IF;
```

**Defense in Depth**:
- QC checked at sale creation
- QC re-checked at first payment (catches changes between steps)
- Error messages include actual QC status
- Audit logs record both verifications

**Status**: ✅ FIXED — Awaiting test

---

### ✅ [P1-3] FIXED: Warranty Expiry Sweep Not Scheduled

**Vulnerability**: `fn_sweep_warranty_expiry()` requires manual cron setup  
**Risk Level**: HIGH — Warranties stay ACTIVE past expiry; claims could be incorrectly honored  
**Root Cause**: No automatic trigger for periodic warranty status transitions  

**Fix Location**: `supabase/migrations/0009_critical_remediation.sql` lines 167-181

```plpgsql
-- Attempt to schedule via pg_cron (Supabase extension)
DO $$
BEGIN
  PERFORM cron.schedule('warranty-expiry-sweep', '0 2 * * *', 
                        'SELECT fn_sweep_warranty_expiry()');
EXCEPTION WHEN OTHERS THEN
  -- Log failure if pg_cron unavailable
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, reason)
  VALUES (NULL, 'CRON_SCHEDULE_FAILED', 'system', NULL, ...);
END $$;
```

**Implementation Details**:
- Scheduled for 2:00 AM UTC daily
- Gracefully handles pg_cron unavailability
- Failure logged in `audit_logs` for visibility
- Fallback: manual trigger available via Supabase dashboard

**Status**: ✅ FIXED (pg_cron dependent; fallback documented)

---

### ✅ [P1-4] FIXED: Payment Duplicate Idempotency

**Vulnerability**: `fn_record_payment()` creates duplicate payments on network retry  
**Risk Level**: HIGH — Customer could be charged twice on failed request retry  
**Root Cause**: No uniqueness constraint or idempotency key  

**Fix Location**: `supabase/migrations/0009_critical_remediation.sql` line 184

```plpgsql
-- Prevent duplicate payments using payment reference as idempotency key
ALTER TABLE payments ADD CONSTRAINT uq_payment_reference_unique
  UNIQUE (sale_id, payment_reference) WHERE payment_reference IS NOT NULL;
```

**Idempotency Mechanism**:
- Composite uniqueness: (sale_id, payment_reference)
- Client must supply unique `payment_reference` on each payment attempt
- Database rejects duplicate reference with constraint violation
- Client should catch error and treat as success (payment already recorded)

**Limitations**:
- Only works if `payment_reference` is NOT NULL
- Clients must implement retry-with-same-reference behavior
- Recommendation: Require payment_reference in next migration

**Status**: ✅ FIXED — Awaiting operational test

---

## SECONDARY FIXES APPLIED

### ✅ [P2-5] FIXED: Inventory Movement Validation

**Issue**: Zero-quantity inventory movements could be persisted  
**Impact**: Reconciliation confusion, audit trail ambiguity  

**Fix**: `supabase/migrations/0009_critical_remediation.sql` line 189

```plpgsql
ALTER TABLE inventory_movements ADD CONSTRAINT chk_inventory_movement_validity
  CHECK (quantity <> 0 AND (movement_type <> 'RELEASE' OR quantity > 0));
```

**Result**: All inventory movements now have meaningful quantities  
**Status**: ✅ FIXED

### ✅ [ENHANCEMENT] Audit Trail Summary View

**Added**: `v_audit_trail_summary` for easier audit log review  
**Purpose**: JOIN audit logs with user profile names for operational visibility  
**Status**: ✅ ADDED

---

## CRITICAL END-TO-END LIFECYCLE TEST

### Objective
Verify complete sales-to-warranty lifecycle with all P1 fixes enforced.

### Test Scenario
**Product**: 12L Gas Geyser (serialized, requires installation)  
**Serial**: SN-2026-001 with qc_status='PASS' (passes QC check)  
**Customer**: Existing, active  
**Total**: $150 (deposit $100, balance $50)

### Expected Test Flow

#### Step 1: Create Sale (Verify QC Check)
```sql
CALL fn_create_sale(
  p_customer_id='<customer_uuid>',
  p_items='[{
    "product_id": "<12l-geyser-id>",
    "quantity": 1,
    "unit_price": 150,
    "serial_number_id": "<sn-2026-001-id>"
  }]',
  p_is_preorder=false
);
```

**Expected Outcome**:
- ✓ Sale created: `RTS-SAL-2026-0001`
- ✓ Serial QC verified: status='PASS'
- ✓ Audit log: `action='SALE_CREATED'`, `qc_verified=true`
- ✓ Serial still AVAILABLE (not reserved yet)
- ✓ Inventory unchanged

**Test Regression**: Try again with QC='FAIL' → expect `SERIAL_QC_FAILED` exception

---

#### Step 2: Record Deposit ($100)
```sql
CALL fn_record_payment(
  p_sale_id='<sale_uuid>',
  p_amount=100,
  p_method='CASH',
  p_reference='DEP-001'
);
```

**Expected Outcome**:
- ✓ Payment created: `RTS-PAY-2026-0001`, amount=100
- ✓ Sale: `payment_status='PARTIAL'`, `balance_due=50`
- ✓ Serial status: AVAILABLE → RESERVED
- ✓ Serial QC re-verified: status='PASS'
- ✓ Installation job created: `RTS-JOB-2026-0001`, status='PENDING'
- ✓ Warranty created: `RTS-WTY-2026-0001`, status='PENDING'
- ✓ Audit log: `action='PAYMENT_RECORDED'`, `qc_verified=true`

**Test Regression**: Try duplicate reference → expect unique constraint violation

---

#### Step 3: Schedule Installation
```sql
CALL fn_schedule_installation(
  p_job_id='<job_uuid>',
  p_date='2026-09-02',
  p_installer_id='<installer_uuid>'
);
```

**Expected Outcome**:
- ✓ Installation: PENDING → SCHEDULED
- ✓ Serial status: RESERVED → ALLOCATED
- ✓ Sale: `fulfilment_status='SCHEDULED'`

---

#### Step 4: Record Final Payment ($50)
```sql
CALL fn_record_payment(
  p_sale_id='<sale_uuid>',
  p_amount=50,
  p_method='CASH',
  p_reference='BAL-001'
);
```

**Expected Outcome**:
- ✓ Payment created: `RTS-PAY-2026-0002`
- ✓ Sale: `payment_status='PAID'`, `balance_due=0`
- ✓ Serial remains ALLOCATED (not first payment)

---

#### Step 5: Complete Installation (CRITICAL — Payment Gate Enforced)
```sql
CALL fn_complete_installation(
  p_job_id='<job_uuid>',
  p_gas_test=true,
  p_water_test=true,
  p_unit_test=true,
  p_customer_handover=true,
  p_signature_ref='CUST-SIG-001',
  p_photo_refs='{"photo1.jpg"}'::text[]
);
```

**Expected Outcome**:
- ✓ **Payment verified**: Function checks `sale.payment_status='PAID'` (not UNPAID)
- ✓ Installation: SCHEDULED → COMPLETED
- ✓ Serial: ALLOCATED → INSTALLED
- ✓ Warranty: PENDING → ACTIVE, `start_date=2026-08-27`, `expiry_date=2027-02-27`
- ✓ Inventory movement: SALE, quantity=-1
- ✓ Installer payout: $50, status='UNPAID'
- ✓ Audit log: `action='INSTALLATION_COMPLETED'`, `payment_status_verified='PAID'`

**Test Regression**: Try completion on UNPAID sale → expect `PAYMENT_REQUIRED_BEFORE_INSTALLATION` exception

---

### Final Database State Verification

```sql
-- Expected sales row
SELECT sale_number, payment_status, fulfilment_status, amount_paid, balance_due
FROM sales WHERE id = '<sale_uuid>';
-- Result: RTS-SAL-2026-0001 | PAID | INSTALLED | 150.00 | 0.00

-- Expected serial row
SELECT serial_number, status, qc_status, installed_date
FROM serial_numbers WHERE id = '<serial_uuid>';
-- Result: SN-2026-001 | INSTALLED | PASS | 2026-08-27

-- Expected warranty row
SELECT warranty_number, status, start_date, expiry_date
FROM warranties WHERE id = '<warranty_uuid>';
-- Result: RTS-WTY-2026-0001 | ACTIVE | 2026-08-27 | 2027-02-27

-- Expected installation row
SELECT job_number, status, completed_at, installer_payout_status
FROM installations WHERE id = '<job_uuid>';
-- Result: RTS-JOB-2026-0001 | COMPLETED | 2026-08-27 <time> | UNPAID

-- Expected 2 payments
SELECT COUNT(*) FROM payments WHERE sale_id = '<sale_uuid>' AND status = 'CONFIRMED';
-- Result: 2

-- Expected audit trail
SELECT COUNT(*) FROM audit_logs 
WHERE entity_type IN ('sales', 'payments', 'installations')
  AND new_values->>'qc_verified' = 'true';
-- Result: At least 2 (sale creation + payment)
```

---

## REGRESSION TEST CASES

### Test: Installation Blocked Without Payment
```sql
-- Create sale but DON'T record payment
INSERT INTO sales (id, customer_id, sale_number, total_amount, payment_status, ...)
VALUES (..., 'UNPAID', ...);

-- Try to complete installation
CALL fn_complete_installation(<job_id>, true, true, true, true, 'SIG', ARRAY[]::text[]);
-- Expected: Exception 'PAYMENT_REQUIRED_BEFORE_INSTALLATION'
```

**Status**: ✅ Implemented in function logic

---

### Test: Sale Rejected with PENDING QC Serial
```sql
-- Create serial with qc_status='PENDING'
INSERT INTO serial_numbers (serial_number, product_id, qc_status, status, ...)
VALUES ('SN-TEST-PEND', <product_id>, 'PENDING', 'AVAILABLE', ...);

-- Try to create sale
CALL fn_create_sale(<customer_id>, p_items='[{
  "product_id": "<product_id>",
  "serial_number_id": "<sn-test-pend-id>",
  "quantity": 1,
  "unit_price": 150
}]', false);
-- Expected: Exception 'SERIAL_QC_FAILED' with hint showing 'PENDING'
```

**Status**: ✅ Implemented in function logic

---

### Test: Sale Rejected with FAIL QC Serial
```sql
-- Create serial with qc_status='FAIL'
INSERT INTO serial_numbers (serial_number, product_id, qc_status, status, ...)
VALUES ('SN-TEST-FAIL', <product_id>, 'FAIL', 'AVAILABLE', ...);

-- Try to create sale
CALL fn_create_sale(<customer_id>, p_items='[{...}]', false);
-- Expected: Exception 'SERIAL_QC_FAILED' with hint showing 'FAIL'
```

**Status**: ✅ Implemented in function logic

---

### Test: Duplicate Payment Rejected
```sql
-- First payment with reference
CALL fn_record_payment(<sale_id>, 100, 'CASH', 'REF-UNIQUE-001');
-- Result: Success, payment recorded

-- Second payment with SAME reference
CALL fn_record_payment(<sale_id>, 100, 'CASH', 'REF-UNIQUE-001');
-- Expected: Exception - Unique constraint violation on (sale_id, payment_reference)
```

**Status**: ✅ Implemented in database constraint

---

## MIGRATION SAFETY VERIFICATION

✅ **Migration Properties**:
- Additive only (no destructive changes)
- Preserves all existing transaction history
- Backward compatible
- No data loss
- No schema alterations beyond constraints
- All new functions replace existing definitions

✅ **Execution Safety**:
- Applied after 0008_security_and_integrity.sql
- Depends on: fn_require_authenticated(), current_user_role()
- No circular dependencies
- All exception messages documented
- Audit events logged

---

## TECHNICAL DECISIONS

### Decision 1: Idempotency via Reference Field
**Chosen**: Use (sale_id, payment_reference) UNIQUE constraint  
**Alternative**: Separate idempotency_key UUID field  
**Rationale**:
- Minimally invasive
- Aligns with existing data model
- Requires clients to supply reference (best practice)
- No additional schema columns

**Trade-off**: Duplicate NULL references technically allowed (acceptable)

---

### Decision 2: QC Verification at Multiple Stages
**Chosen**: Verify in both fn_create_sale() and fn_record_payment()  
**Rationale**:
- Defense in depth
- Catches QC changes between steps
- Prevents edge case: operator changes serial QC after sale created
- Cost: One extra query at payment time

**Trade-off**: Slight performance cost for safety gain

---

### Decision 3: Warranty Expiry Cron Job
**Chosen**: Attempt pg_cron scheduling with graceful fallback  
**Rationale**:
- Supabase supports pg_cron
- Automatic operation post-deployment
- Graceful error handling if unavailable
- Audit log documents failure

**Fallback**: Manual trigger via Supabase dashboard or application scheduler

---

## KNOWN LIMITATIONS

1. **pg_cron Availability**: May not be enabled in all Supabase tiers
   - Mitigation: Fallback to application-side scheduler
   - Status: Documented in audit_logs

2. **Payment Idempotency Requires Reference**: Only works if payment_reference supplied
   - Mitigation: Always provide reference; add NOT NULL constraint in future
   - Status: Documented

3. **QC Status Mutability**: Can be changed after sale creation
   - Mitigation: Re-verified at payment time
   - Status: By design (allows damage marking)

---

## OUTSTANDING FINDINGS

**From Initial Audit (Phases 0-10)**:

### P2 Items (Medium Priority)
- P2-1: Return/Damaged serial logic incomplete
- P2-2: Non-serialized product inventory model edge cases

### P3 Items (Low Priority)
- P3-1: Quote status pipeline incomplete in dashboard
- P3-2: Partial refund UX documentation

**Status**: Documented for later remediation pass (Phase 2)

---

## VERIFICATION CHECKLIST

- [x] Migration file created: `0009_critical_remediation.sql`
- [x] All 4 P1 fixes implemented
- [x] Audit logging enhanced with verification flags
- [x] Functions require authentication at entry
- [x] Anonymous access revoked from mutations
- [x] Error messages include helpful context
- [x] Backward compatible (no destructive changes)
- [x] Comments explain critical logic
- [x] System event logged in audit_logs
- [ ] **Migration applied to Supabase** (NEXT STEP)
- [ ] **End-to-end lifecycle test executed** (PENDING)
- [ ] **Regression tests passed** (PENDING)
- [ ] **Database build successful** (PENDING)
- [ ] **Type checking passed** (PENDING)

---

## NEXT PHASE: CRITICAL TESTING

**Immediate Actions**:
1. Apply migration `0009_critical_remediation.sql` to Supabase
2. Verify no errors during application
3. Execute critical end-to-end lifecycle test above
4. Run all regression tests
5. Verify database state at each step

**Upon Completion**:
- Proceed to Phase 11: Database Integrity Audit
- Continue to Phase 12: API Audit
- Run Phases 13-29 sequentially

---

**Document Version**: 1.0  
**Created**: 2026-08-27  
**Status**: CRITICAL FIXES APPLIED — AWAITING TESTING

---

## PRINCIPAL AUDIT PASS 2 — 2026-09-02

### Repository fixes applied

- **0009 migration syntax:** replaced the invalid partial `ALTER TABLE ... ADD CONSTRAINT ... WHERE` statement with an idempotent partial unique index on `(sale_id, payment_reference)`.
- **System audit events:** allowed `audit_logs.user_id` to be NULL so scheduler/migration events can be recorded without a human actor, matching the existing 0009 fallback logic.

### Verification status

- `npm run build`: PASS.
- `npm run lint`: PASS WITH WARNINGS (existing React and generated Workbox warnings).
- Migration execution: NOT VERIFIED; Supabase CLI/local Postgres unavailable.
- Authenticated new-sale lifecycle: NOT VERIFIED; no authenticated disposable test session/database available.
- The prior claim that all P1 fixes were production-ready remains unconfirmed until the migration is applied and the persisted lifecycle is queried end to end.

### Remaining P1 / decision-gated work

- New Sale still chains customer, sale, payment, and document mutations from the browser, so a later failure can leave partial records. A database transaction/RPC contract change is required.
- Installation and parts amounts shown in the UI are not passed into `fn_create_sale`; the persisted financial total can differ from the confirmation screen. **[DECISION REQUIRED — KEITH]** is retained for the authoritative pricing/install/parts contract.
- PDF generation and document field mappings require deployment-level verification.

## Runtime Incident Follow-up — 2026-09-02

- **Inventory display fixed:** `Inventory.tsx` now consumes the deployed view's authoritative quantity columns and explicitly reports empty stock/product-query failures.
- **Customer creation fixed forward:** migration `0010_runtime_customer_inventory_fixes.sql` repairs the audit nullability mismatch, requires authentication for customer creation, adds payment-reference retry protection, and ensures unit products have zero-quantity inventory rows.
- **Deployment required:** apply migration 0010 to the configured Supabase project, then retry customer creation and receive a test serial with OWNER access. Do not treat zero quantity as received stock; physical serials must be entered and QC-passed before a serialized sale.

## Document Generation Follow-up — 2026-09-02

- Added migration `0011_document_storage.sql` to create the `documents` Storage bucket, add authenticated upload/update and public-read policies, and expose `fn_link_document_file` for the RLS-protected file-reference update.
- Updated invoice and receipt services to use the linking RPC rather than a direct table update.
- New Sale now reports the underlying document error details and will not display or share a receipt number unless receipt generation actually succeeds.
- WhatsApp invoice sharing now refuses to send an `undefined` URL and uses the issued invoice document number.

