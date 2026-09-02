# Rafiki System Audit

## Initial Audit Scope

Date: 2026-08-27  
Scope: Phases 0-10 only  
Mode: Read-only forensic audit; no application code or database migration was changed for this audit.  
Evidence: repository source, SQL migrations, configuration, `npm run build`, `npm run lint`, and `npm test` results.

This is an initial findings report, not a production-readiness certification. Authenticated browser flows, live database state, migration execution, concurrency tests, and PDF rendering against deployed services remain unverified.

## Executive Summary

The repository contains a coherent intended architecture: React/Vite frontend, Supabase Auth/Postgres/Storage, PostgreSQL RPCs for multi-step mutations, PWA caching, and PDF/XLSX services. The production build succeeds and route-level code splitting is working.

The implementation is **not safe to operate as a real financial and inventory system** in its current state. The highest-risk defects are cross-layer contract failures and security gaps:

- Several `SECURITY DEFINER` functions do not verify an authenticated caller. If exposed through Supabase RPC privileges, unauthenticated callers may invoke privileged data mutations.
- The New Sale flow submits fields that do not match the authoritative schema, ignores customer insert errors, trusts client prices, and omits installation labour and parts from the RPC payload.
- Document services use stale column names and the PDF Edge Function generates mock PDF bytes while updating columns that do not exist in the authoritative schema.
- Installation scheduling and completion lack sufficient state/authorization guards and do not consistently create the promised document/audit trail.
- The repository has no test script and no executable database test harness, so the complete lifecycle has not been proven.

**Initial disposition: NOT READY.**

## System Architecture As Found

### Frontend

- React with TypeScript and Vite.
- Entry point: `src/main.tsx`.
- TanStack Query is provided globally for server-state reads.
- React Router is configured in `src/App.tsx`.
- Route pages are lazy-loaded with `React.lazy` and `Suspense`.
- Shared shell/navigation: `src/components/layout/AppShell.tsx`.
- Supabase browser client: `src/lib/supabase.ts`.
- Business RPC wrappers: `src/lib/rpc.ts`.
- PDF/document service: `src/lib/documents.ts` and `src/lib/pdf.ts`.
- XLSX export: `src/lib/xlsx.ts`.

### Backend and external services

- Supabase Postgres schema and functions under `supabase/migrations/`.
- Supabase Auth for sessions.
- Supabase Storage for uploaded PDFs, photos, and signatures.
- Supabase Edge Function under `supabase/functions/generate-pdf/`.
- Vercel Node API under `api/render-pdf.ts` for HTML-to-PDF rendering.
- Vite PWA/Workbox service worker generated from `vite.config.ts`.

### Data flow

Reads generally use Supabase table/view queries from page components. Multi-step business mutations are intended to use PostgreSQL RPC functions. Documents are intended to be created as database-linked records and then rendered/uploaded as views. Reporting reads dashboard views and exports live data.

## Phase 0 — Baseline

### Verified

- Package manager: npm.
- Language: TypeScript/TSX and PostgreSQL SQL.
- Frontend framework: React/Vite.
- Database/auth/storage: Supabase.
- Deployment indicators: Vercel API function plus Supabase migrations/functions.
- Build command: `npm run build` succeeds.
- Lint command: `npm run lint` completes with warnings.
- No `test` script exists; `npm test` fails with `Missing script: "test"`.
- No Supabase CLI was found in PATH. Docker is installed, but no local database was started.
- `.env` is ignored by git. It contains a publishable Supabase key; no service-role value was printed or included in this report.

### Baseline warnings

- `src/hooks/useRole.ts` and `src/hooks/useRole.tsx` both define `useRole`; module resolution uses the `.ts` implementation in current imports, while the `.tsx` file contains an unused `RoleProvider` design. This is an architectural ambiguity and a future wiring risk.
- `public/` contains only `favicon.svg` and `icons.svg`, while the PWA manifest references `pwa-192x192.png` and `pwa-512x512.png`. The build succeeds, but those icons are not present in the repository.

## Phase 1 — System Map

### New Sale

`src/pages/NewSale.tsx` → direct customer insert → `fn_create_sale` → optional `fn_record_payment` → `issueReceipt` → `issueInvoice` → Storage/API document rendering.

This path is not coherent end to end because the direct customer insert does not match the schema, sale totals are client-derived, and document service fields do not match the schema.

### Payment

`SaleWorkspace.tsx` → `recordPayment()` → `fn_record_payment` → payment row, sale totals/status, cash movement, first-payment serial reservation, optional installation job, audit row → receipt generation.

The RPC locks the sale row, which is a good concurrency control for sale balance updates, but there is no visible idempotency key for retry-safe payment submission.

### Installation

`Installations.tsx` reads jobs. `InstallationDetail.tsx` uploads photos/signature and calls `completeInstallation()` → `fn_complete_installation` → serial installed, inventory refreshed, movement inserted, warranty activated, installer obligation recorded, audit row.

There is no complete scheduling/assignment UI in the inspected route surface; scheduling is exposed through a wrapper but not demonstrated as a usable page workflow.

### Warranty

`fn_create_install_job` creates a pending warranty. `fn_complete_installation` activates it from `CURRENT_DATE` and a settings duration. `issueWarrantyCertificate()` then attempts to create and render a certificate.

The database activation logic is directionally aligned with the six-month-from-installation rule, but the certificate service has schema mismatches and completion does not atomically include certificate generation.

### Documents

`src/lib/documents.ts` creates a document with `fn_issue_document`, renders HTML through `/api/render-pdf`, uploads to Storage, and links `documents.file_reference`. The separate Supabase Edge Function is an older conflicting implementation using stale columns and mock PDF bytes.

### Reporting

`Reports.tsx` reads `v_dashboard`, `v_stock_dashboard`, and `obligations`. `src/lib/xlsx.ts` exports five live-data sheets. The reporting UI and export build successfully, but dashboard view semantics still require business-data verification.

## Phase 2 — Business Requirements Audit

### Findings

**P1-01 — Cross-layer schema contract is broken.** `src/pages/NewSale.tsx` inserts `{ full_name, phone, address }` into `customers`, but authoritative `0001_schema.sql` requires `customer_number` and `first_name`, and has no `full_name` column. The insert error is ignored. The fallback `mock-cust-1` then causes `fn_create_sale` to fail with `CUSTOMER_NOT_FOUND`. This blocks the core new-sale lifecycle.

**P1-02 — Required operational areas are stubbed.** `/enquiries`, `/quotes`, `/payments`, and `/settings` render placeholder text in `src/App.tsx`. The commercial lifecycle cannot be completed from the UI as required.

**P1-03 — Generated TypeScript database types are stale.** `src/types/database.ts` uses names such as `total_amount_usd`, `amount_usd`, and document type values that differ from authoritative SQL fields such as `total_amount`, `amount`, `WARRANTY_CERTIFICATE`, and `INSTALLATION_REPORT`. The code compensates with `unknown` casts instead of a verified generated contract.

## Phase 3 — Sales Lifecycle

**P1-04 — Sale creation is not financially complete.** `fn_create_sale` calculates the sale total only from client-supplied sale item prices. The New Sale UI separately calculates `$70` installation labour and a parts amount, but neither is sent to the RPC. The persisted sale therefore disagrees with the confirmation UI.

**P1-05 — Client controls historical commercial values.** `fn_create_sale` accepts `unit_price` and `discount` from `p_items` and uses them directly. It verifies that a product is active, but does not derive the price from `products` or authorize a price override. A modified client can create arbitrary prices, discounts, or potentially negative line totals.

**P1-06 — New Sale is a chain of non-atomic operations.** Customer creation, sale creation, payment, receipt issuance, invoice issuance, storage upload, and document linking are separate calls. A later failure leaves earlier records committed. The UI only reports overall success after the chain, but there is no compensating workflow for partial completion.

**P1-07 — Serial reservation and installation creation are coupled to the first payment, not an explicitly completed sale transition.** This may match the stated first-payment reservation rule, but the system does not expose a robust cancellation/release workflow from the UI, and mixed preorder/serialized item behavior is not clearly constrained.

## Phase 4 — New Sale Forensic Test

### Static reproduction

1. Enter a customer in `NewSale.tsx`.
2. Submit the form.
3. The direct insert sends `full_name`, which is not an authoritative column, and omits required `customer_number` and `first_name`.
4. The insert error is discarded.
5. `customerId` remains `mock-cust-1`.
6. `fn_create_sale` checks for that ID and raises `CUSTOMER_NOT_FOUND`.

This is statically reproducible. It was not executed against the remote database because no authenticated test account or safe test dataset was provided.

### Not verified

Existing customer sale, new customer sale, quantity, pricing, serial allocation, installation date, persisted payment, invoice, receipt, installation job, inventory movement, customer history, and audit state require a live authenticated environment and database assertions. No such test harness exists locally.

## Phase 5 — Financial Integrity

**P0-01 — Client-submitted prices and discounts can alter financial truth.** This violates the rule that prices must be configured server-side and sale prices must be snapshotted by trusted business logic.

**P1-08 — UI totals are not persisted totals.** `NewSale.tsx` displays item totals plus installation and parts, while `fn_create_sale` persists only item totals. The customer-facing invoice service also reads stale field names and cannot be assumed to represent the persisted sale.

**P1-09 — Payment retries are not idempotent.** `fn_record_payment` creates a new payment number and cash movement for every successful invocation. A network timeout followed by a retry can double-charge the sale. The row lock prevents a balance race but does not prevent duplicate intent.

**P1-10 — Refund handling is incomplete.** `fn_issue_refund` records a refund and cash movement, but a full refund inserts an inventory `RELEASE` movement with quantity `0`. Inventory counts are refreshed from serial status, so the dashboard may look correct while movement reconciliation is wrong. Multiple-payment refund state is also only partially reflected on the selected payment row.

**P1-11 — Obligation settlement lacks input bounds.** `fn_settle_obligation` does not reject non-positive amounts, missing obligations, or settlement beyond the obligation total. This was identified statically; live execution was not available.

## Phase 6 — Inventory

**P1-12 — Duplicate receiving creates false movement history.** `fn_receive_stock` uses `ON CONFLICT DO NOTHING` for an existing serial, but still inserts a `PURCHASE` movement and increments its return count. Re-receiving a serial therefore corrupts inventory movement history even if the serial-count dashboard remains unchanged.

**P1-13 — Stock velocity includes inappropriate rows.** `v_stock_dashboard` calculates 28-day sales velocity from all `sale_items` joined to `sales`, without excluding cancelled sales or clearly excluding preorder/non-stock items. Days-of-stock and reorder status can therefore be wrong.

**P1-14 — Inventory movement semantics are inconsistent.** Serialized inventory is primarily recomputed from serial statuses, while movements are also inserted for sale/release/receiving. The system needs a documented reconciliation model; currently a release with quantity zero is direct evidence that movement totals cannot be trusted.

## Phase 7 — Serial Numbers

**P1-15 — Status adjustment can violate lifecycle invariants.** `fn_adjust_serial_status` allows arbitrary transitions among `AVAILABLE`, `RESERVED`, `ALLOCATED`, `INSTALLED`, `RETURNED`, `DAMAGED`, and `SCRAPPED` without clearing or validating `sale_id`, `customer_id`, or `installation_id`. An installed or sold unit can be manually marked available while retaining historical associations, or a damaged unit can be made available without QC gates.

**P1-16 — Serial format is not enforced.** The schema enforces uniqueness but not the required `GH-{SKU}-{seq}` format or consistency between serial prefix and product SKU. Receiving accepts arbitrary strings.

## Phase 8 — Installation

**P0-02 — Privileged RPC authentication is incomplete.** `fn_schedule_installation`, `fn_complete_installation`, `fn_create_install_job`, `fn_record_payment`, `fn_receive_stock`, and `fn_issue_document` are `SECURITY DEFINER` but do not explicitly reject `auth.uid() IS NULL`. RLS does not protect operations performed inside a security-definer function unless the function itself checks the caller and validates authorization. Supabase function EXECUTE exposure must be checked in the deployed database.

**P1-17 — Scheduling has weak state validation.** `fn_schedule_installation` does not verify the current job state, installer existence/status, serial ownership, or that the serial is reserved for the same sale before setting it allocated. It also writes no audit row.

**P1-18 — Completion has weak state validation.** `fn_complete_installation` checks the checklist and signature but does not require a scheduled/allocated state, does not explicitly reject completion of cancelled jobs, and does not verify a valid pending warranty before updating it.

**P1-19 — Installation completion does not create an installation report.** The database function creates an audit row and activates warranty, but no installation-report document is issued in the inspected flow. The UI then issues only a warranty certificate.

## Phase 9 — Warranty

**P1-20 — Warranty certificate generation is not reliable.** `src/lib/documents.ts` queries stale field names in related sale/payment services and depends on a document-linking path that differs from the old Edge Function. A completed installation can therefore commit warranty activation while certificate generation fails afterward.

**P1-21 — Warranty terms are not fully snapshotted at activation.** The warranty table has `terms_version` and `duration_months`, but `fn_complete_installation` updates dates/status without explicitly snapshotting the active terms version or duration into the row. Historical reproducibility is therefore not demonstrated.

**P2-01 — Date/timezone behavior is unverified.** Business rules require Africa/Harare display and UTC storage. SQL uses `CURRENT_DATE` without evidence that the database session timezone is configured for Africa/Harare, while the client uses browser-local date formatting.

## Phase 10 — Documents

**P0-03 — The Supabase PDF Edge Function is not a production renderer.** `supabase/functions/generate-pdf/index.ts` creates a text buffer containing `%PDF-1.4 Mock Document Content`, ignores `template_name`, fetches stale document fields (`doc_type`, `doc_number`), and updates `pdf_url`, while the authoritative schema uses `document_type`, `document_number`, and `file_reference`. It also creates a service-role client without validating the inbound user token.

**P1-22 — Browser document service uses stale schema fields.** `src/lib/documents.ts` selects `system_settings` columns that do not exist in the key/value schema and reads `unit_price_usd`, `total_amount_usd`, `paid_amount_usd`, and `balance_due_usd`, while authoritative SQL uses `unit_price`, `total_amount`, `amount_paid`, and `balance_due`. Invoice/receipt generation will fail or render incomplete data.

**P1-23 — Document issuance is not linked to the source record safely.** `fn_issue_document` validates only the document type. It does not verify that the supplied customer, sale, payment, installation, and warranty IDs exist and agree with one another. It is also a `SECURITY DEFINER` function without an explicit authentication/authorization guard.

**P2-02 — HTML output is not escaped.** `lineItemRow()` inserts product descriptions and serials directly into HTML. A stored value containing markup can alter the rendered document. This is a document-generation XSS/integrity risk.

## Security and Authorization Observations Within Phases 0-10

- `api/render-pdf.ts` accepts arbitrary HTML from a POST request and has no authentication or authorization check. It should not be treated as a public rendering endpoint.
- The API handler uses `any` for request/response and has no request-size limit or structured input validation.
- UI role hiding is not sufficient; database function authorization must be authoritative.
- `useRole.ts` and `useRole.tsx` duplicate role implementations. The active `.ts` hook reads the profile but does not use the `RoleProvider` implementation. This makes role behavior easy to misunderstand and test incorrectly.

## Validation Performed

- `npm run build`: passed. Production PWA assets were generated and route chunks were emitted; no chunk-size warning remained.
- `npm run lint`: completed with warnings in the duplicate role hook/Fast Refresh rule, impure `Date.now()` use in `Warranties.tsx`, and generated Workbox files.
- `npm test`: not available; package has no test script.
- Supabase CLI: not available in PATH.
- Docker: installed, but no database container was started.
- Browser E2E: not performed; no shared browser page or test credentials were available.
- Remote Supabase database assertions: not performed; no safe authenticated test account/data reset procedure was available.

## Initial Health Ratings

These are provisional ratings for the inspected Phase 0-10 surfaces, not final ratings for deferred phases.

| Category | Rating | Reason |
|---|---:|---|
| Architecture | 2/5 | Intended boundaries exist, but duplicate hooks and conflicting PDF implementations remain. |
| Database | 2/5 | Strong schema intent, but privileged functions and cross-layer contracts are unsafe. |
| Sales | 1/5 | Core New Sale path is statically blocked by schema mismatch and incomplete totals. |
| Payments | 2/5 | Sale locking and server balance calculation exist; idempotency and authorization gaps remain. |
| Inventory | 2/5 | Serial-derived counts exist, but movement and receiving reconciliation are unreliable. |
| Serial Tracking | 2/5 | Unique IDs and statuses exist; arbitrary transitions are permitted. |
| Installations | 2/5 | Completion logic exists, but scheduling/state/auth/document gaps are material. |
| Warranty | 2/5 | Six-month completion activation is present; reproducibility and document flow are broken. |
| Documents | 1/5 | Browser service and Edge Function disagree with schema; one renderer is explicitly mock. |
| Authentication | 2/5 | Login/session tracking exists; service/API caller enforcement is unverified or absent. |
| Authorization | 1/5 | UI gating exists, but SECURITY DEFINER RPC guards are incomplete. |
| Testing | 0/5 | No test script or database/E2E harness exists. |

## Deferred Phases

Phases 11-29 require a subsequent pass after these initial findings are reviewed and after a safe test database/account is available. In particular: full relationship/data reconciliation, deployed RPC privilege inspection, concurrency tests, live PDF tests, role-by-role access tests, performance tests, migration execution, and authenticated browser workflows.

## Open Decisions

- **[DECISION REQUIRED — KEITH]** Confirm the authoritative customer creation and sale pricing workflow before remediation: the UI currently calculates installation/parts separately, while the database sale function does not accept those values.
- **[DECISION REQUIRED — KEITH]** Confirm whether overpayments are allowed as `OVERPAID` or must be rejected at payment entry.
- **[DECISION REQUIRED — KEITH]** Confirm whether all installed jobs must produce an installation report document in V1.
- **[DECISION REQUIRED — KEITH]** Confirm the canonical naming variant and final asset set for PWA/document branding if not already settled in the supplied business documentation.

## Initial Conclusion

The project is buildable but not operationally trustworthy. The first remediation block should address RPC authentication/privilege exposure, the New Sale/schema/price contract, and the document generation contract before any live financial or inventory use.

## Audit Pass 2 — Principal-Agent Verification (2026-09-02)

This pass independently reconciled the repository with the prior remediation log and ran the available local checks. It did not treat the claimed deployment of migration 0009 as evidence of deployment.

### Evidence

- `npm run build`: **PASS** (TypeScript build and Vite production bundle).
- `npm run lint`: **PASS WITH WARNINGS** (React purity/Fast Refresh warnings and generated Workbox warnings).
- Authenticated Supabase lifecycle test: **NOT TESTABLE IN CURRENT ENVIRONMENT**. The repository contains only a publishable/anonymous client key; no authenticated test session, test-user credentials, or disposable database was provided.
- Migration execution: **NOT TESTABLE LOCALLY**. Supabase CLI/local Postgres is not installed in this environment.

### Newly Reproduced/Confirmed Findings

1. **P0 deployment blocker in 0009 (fixed in repository):** PostgreSQL rejects a partial `UNIQUE` constraint expressed as `ALTER TABLE ... ADD CONSTRAINT ... WHERE`. This was replaced with an equivalent partial unique index.
2. **P1 migration fallback blocker in 0009 (fixed in repository):** system audit rows use `user_id = NULL`, but the base schema marked `audit_logs.user_id NOT NULL`. The remediation migration now explicitly permits system-generated audit events.
3. **P1 workflow integrity remains open:** `NewSale.tsx` performs customer creation, sale creation, payment, and document issuance as separate calls. Installation and parts are included in browser totals but are not represented in the `fn_create_sale` input or persisted sale total. This requires an architectural fix and confirmation of the intended commercial contract.
4. **P1 document risk remains open:** the PDF edge function and browser document service still require schema/authorization/runtime verification against a deployed Supabase project.

### Current readiness

The local application is **PARTIALLY READY for continued engineering**, but **NOT READY for live financial/inventory operations** until migration 0009 is applied successfully and an authenticated disposable end-to-end lifecycle test verifies persisted records.

## Runtime Verification — 2026-09-02

A read-only probe of the configured Supabase REST endpoint confirmed:

- `v_stock_dashboard` is reachable but currently exposes zero-quantity stock (only one seeded SKU row was returned), not received physical units.
- `fn_create_customer` currently fails on the deployed schema when called without a session because its audit insert violates `audit_logs.user_id NOT NULL`. The forward migration 0010 adds the authentication guard and permits system-event audit rows; an authenticated browser retry is still required after deployment.
- The frontend Inventory type was inconsistent with the deployed view (`quantity_available`, `quantity_reserved`, `quantity_on_hand`), which has now been corrected.

Document generation was also traced: PDF upload/linking depended on an undeclared Storage bucket/policy and a direct `documents` update that is blocked by the documented RLS policy for non-OWNER users. Migration 0011 and the RPC-backed client path now address that contract. Deployment and authenticated PDF rendering still require verification in Supabase/Vercel.
