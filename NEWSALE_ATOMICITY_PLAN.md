# NewSale Atomicity & Network Resilience Plan

## 1. Current Network Call Chain in `NewSale.tsx`

During submission (`handleConfirmSale` in `src/pages/NewSale.tsx:192-281`), the browser executes up to **12 separate, sequential HTTP requests** across Supabase PostgREST, Supabase Storage, and Vercel serverless endpoints:

```
[Browser Client: handleConfirmSale]
  │
  ├─ 1. RPC: fn_create_customer             ───▶ Commits customer row (independent tx)
  │
  ├─ 2. RPC: fn_create_sale                 ───▶ Commits sale & sale_items rows (independent tx)
  │
  ├─ 3. [If amountPaidNow > 0]:
  │     ├─ a. RPC: fn_record_payment        ───▶ Commits payment, reserves serial, creates job/warranty (independent tx)
  │     ├─ b. REST: from('payments').select ───▶ Reads latest payment_id
  │     ├─ c. RPC: fn_issue_document(RCP)   ───▶ Inserts receipt document row
  │     ├─ d. API: POST /api/render-pdf     ───▶ Calls Chromium PDF renderer
  │     ├─ e. STORAGE: documents.upload     ───▶ Uploads receipt PDF to Supabase Storage
  │     └─ f. RPC: fn_link_document_file    ───▶ Links storage path to receipt document row
  │
  └─ 4. [Always]:
        ├─ a. RPC: fn_issue_document(INV)   ───▶ Inserts invoice document row
        ├─ b. API: POST /api/render-pdf     ───▶ Calls Chromium PDF renderer
        ├─ c. STORAGE: documents.upload     ───▶ Uploads invoice PDF to Supabase Storage
        └─ d. RPC: fn_link_document_file    ───▶ Links storage path to invoice document row
```

### Critical Vulnerabilities in Current Architecture
1. **Zero Multi-Call Transactional Atomicity:** Each RPC runs in its own discrete database transaction and commits immediately.
2. **Orphaned Customer Rows:** If Step 2 (`fn_create_sale`) fails (e.g. serial was concurrently snatched or connection dropped), the customer created in Step 1 remains committed with no sale.
3. **Unfulfilled / Unreserved Sales:** If Step 3a (`fn_record_payment`) fails or times out after Step 2 succeeds, an `UNPAID` sale exists without a reserved serial number and without an installation job or warranty.
4. **Document Half-States:** If network drops during PDF generation or storage upload (Steps 3d-f or 4b-d), the database document row exists with `file_reference = NULL`.
5. **High Mobile Latency:** On cellular networks (3G/LTE in Zimbabwe), 10–12 sequential round trips produce a 5–15 second submission window during which connection drops are frequent.

---

## 2. Proposed Options

### Option A: Database-Level Atomic Transaction (`fn_create_sale_full`)

Combine all database mutations into a single atomic PostgreSQL RPC function executed within one database transaction.

#### Architecture:
1. Create a new migration `0017_create_sale_full.sql` introducing `fn_create_sale_full`:
   ```sql
   fn_create_sale_full(
     p_customer JSONB,          -- { first_name, last_name, phone, address, city, customer_type }
     p_items    JSONB,          -- array of { product_id, quantity, serial_number_id, is_preorder }
     p_payment  JSONB DEFAULT NULL, -- { amount, payment_method, reference }
     p_sale_meta JSONB DEFAULT '{}' -- { referral_partner_id, notes, is_preorder }
   ) RETURNS JSONB;
   ```
2. **Within the single transaction:**
   - Find existing customer by phone or insert new customer via `fn_create_customer`.
   - Verify all serials are `AVAILABLE` and `PASS` QC.
   - Insert sale and sale items (`sales`, `sale_items`).
   - If payment provided (`amount > 0`):
     - Insert payment (`payments`, `cash_movements`).
     - Reserve serials (`serial_numbers.status = 'RESERVED'`).
     - Create installation job and warranty (`installations`, `warranties`).
     - Insert `RECEIPT` document record (`documents`).
   - Insert `INVOICE` document record (`documents`).
   - Write consolidated audit log entry.
3. **If ANY step fails:**
   - PostgreSQL rolls back the entire transaction.
   - No orphaned customer, no partial sale, no unreserved inventory.
4. **Client-side responsibility:**
   - Makes **1 single RPC call**.
   - Upon receiving `{ sale_id, invoice_id, receipt_id }`, the client triggers background PDF generation and storage upload. If PDF generation fails, the sale is already safely recorded and the documents can be viewed/re-issued at any time from `SaleWorkspace`.

#### Impact & Effort:
- **Files to change:**
  - `supabase/migrations/0017_create_sale_full.sql` (New: ~130 lines SQL)
  - `src/lib/rpc.ts` (Modified: ~25 lines TS)
  - `src/pages/NewSale.tsx` (Modified: ~45 lines TS)
- **Estimated total:** ~130 lines SQL, ~70 lines TypeScript.

#### Evaluation:
- **Pros:** True ACID atomicity; eliminates race conditions; reduces network round-trips from ~12 to 1 for database state; dramatically faster and resilient on unstable mobile data.
- **Cons:** Requires a new database migration; PDF rendering/upload remains asynchronous (already handled gracefully by `SaleWorkspace`).

---

### Option B: Client-Side Progress Checkpointing in `useNewSaleDraft`

Keep existing individual RPCs as-is, but enhance `useNewSaleDraft` to store an execution stage and created entity IDs in IndexedDB so the client can resume an interrupted submission.

#### Architecture:
1. Extend `NewSaleDraftData` in `src/hooks/useNewSaleDraft.ts`:
   ```typescript
   export interface NewSaleDraftData {
     // ... existing form fields ...
     submissionProgress?: {
       stage: 'IDLE' | 'CUSTOMER_CREATED' | 'SALE_CREATED' | 'PAYMENT_RECORDED';
       customerId?: string;
       saleId?: string;
       saleNumber?: string;
       paymentId?: string;
     };
   }
   ```
2. In `NewSale.tsx:handleConfirmSale`:
   - Check `draft.submissionProgress`:
     - If `customerId` is already saved, skip `createCustomer()`.
     - If `saleId` is already saved, skip `fn_create_sale()`.
     - If `paymentId` is already saved, skip `recordPayment()`.
   - After each successful network step, update `draft.submissionProgress` immediately in IndexedDB.
   - Clear draft only after all steps (or core database steps) complete.
3. If an error or network drop occurs:
   - The UI displays a "Resume Incomplete Sale" banner showing which step failed.
   - The operator can retry without creating duplicate customers or duplicate sales.

#### Impact & Effort:
- **Files to change:**
  - `src/hooks/useNewSaleDraft.ts` (Modified: ~35 lines TS)
  - `src/pages/NewSale.tsx` (Modified: ~75 lines TS)
- **Estimated total:** 0 lines SQL, ~110 lines TypeScript.

#### Evaluation:
- **Pros:** No database migrations or schema alterations required; provides visible recovery UI for operators if connection drops.
- **Cons:** Does **not** provide database-level atomicity. If the operator abandons an interrupted sale or clears browser data, orphaned records remain permanently in PostgreSQL. High client-side complexity (handling edge-case idempotency, payment double-submission risks, and stale serial reservations).

---

## 3. Comparison Matrix

| Criteria | Option A: `fn_create_sale_full` (RPC) | Option B: Draft Checkpointing (Client) |
|---|---|---|
| **Database Atomicity** | **100% Guaranteed** (PostgreSQL atomic transaction) | **No** (Partial records can be orphaned) |
| **Network Round-Trips** | **1 DB call** + async PDF uploads | **3–5 sequential DB calls** + PDF uploads |
| **Mobile Connection Resilience**| **High** (Single request commits everything) | **Medium** (Operator must manually resume) |
| **Duplicate Payment Risk** | **Zero** (All or nothing) | **Moderate** (Requires strict client idempotency) |
| **Database Changes** | 1 new migration file (`0017`) | None |
| **Frontend Changes** | Simplifies `NewSale.tsx` submission logic | Increases state machine complexity in `NewSale.tsx` |
| **Estimated Code Volume** | ~130 lines SQL, ~70 lines TS | 0 lines SQL, ~110 lines TS |

---

## 4. Recommendation Summary

**Option A is strongly recommended.** In financial and stock management operations, atomic database transactions are industry standard to prevent orphaned customer records, unfulfilled sales, and unreserved inventory. Option B can optionally serve as a complementary UX safeguard, but Option A eliminates the root vulnerability at the database layer.
