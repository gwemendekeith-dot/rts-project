# Rafiki Operations Desk — Changelog

All notable changes to this project are documented here.
Format: `[YYYY-MM-DD] vX.X — Category — Description`

---

## [2026-08-27] — Deployment Fixes

### v0.21.0 — Vercel Deployment & Supabase Configuration
**Files:** `api/render-pdf.ts`, `src/lib/supabase.ts`, `README.md`
- Updated the Vercel PDF API function runtime from obsolete `nodejs18.x` to supported `nodejs`
- Added a clear startup error when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing
- Documented the required Vercel Production environment variables and rebuild requirement
- Confirmed `npm run build` passes; the Vite chunk-size message remains a non-blocking warning

---

## [2026-08-26] — Project Inception & Full Build Sprint

---

### v0.1.0 — Project Scaffold
**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, `tailwind.config.js`, `.env.example`
- Initialised Vite + React 18 + TypeScript project in `rts-project/`
- Installed and configured: Tailwind CSS v3, React Router, TanStack Query, React Hook Form + Zod, Zustand, `date-fns`, `lucide-react`, `xlsx@0.18.5`, `@supabase/supabase-js`, `vite-plugin-pwa`
- Set `"type": "module"` in `package.json`; PostCSS config uses ES module `export default` syntax
- Created `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` placeholders

---

### v0.2.0 — Database Architecture: Core Schema
**File:** `supabase/migrations/0001_schema.sql`
- Created `pgcrypto` extension and 13 sequences (`seq_quote`, `seq_invoice`, `seq_receipt`, `seq_warranty_certificate`, `seq_installation_report`, `seq_customer`, `seq_enquiry`, `seq_sale`, `seq_payment`, `seq_job`, `seq_warranty`, `seq_refund`)
- Implemented `fn_next_number(prefix, seq)` — type-prefixed, year-stamped, zero-padded 4-digit document numbering
- Created all **24 operational tables**: system_settings, warranty_terms, profiles, user_roles, customers, installers, referral_partners, products, serial_numbers, enquiries, quotes, quote_items, sales, sale_items, payments, refunds, installations, installation_parts, warranties, inventory, inventory_movements, obligations, cash_movements, documents, audit_logs
- Added deferred FKs for circular refs (`serial_numbers.sale_id`, `serial_numbers.installation_id`)
- Added 5 document cardinality CHECK constraints

**v0.2.1 — Schema Replacement (Authoritative Version)**
- Replaced auto-generated schema with user-supplied authoritative `0001_schema.sql`
- `system_settings`: changed to flat KV store (key / value / value_type)
- `customers`: split full_name into first_name + last_name + business_name; added customer_type, city, referral_source
- `installers`: added installer_number, company_name, is_backup, agreement_on_file
- `sales`: added stored balance_due; richer payment_status enum (OVERPAID, REFUND_DUE, PARTIALLY_REFUNDED); fulfilment_status separated from payment status
- `installations`: expanded status enum — ASSIGNED, IN_PROGRESS, TESTING, INSTALLED, RESCHEDULED, REWORK_REQUIRED
- `payments`: payment_method includes OTHER; status includes REVERSED
- `inventory_movements`: added UNIQUE (serial_number_id, movement_type, reference_id) to prevent double-posting
- `documents`: document_type now uses WARRANTY_CERTIFICATE and INSTALLATION_REPORT
- `audit_logs`: added ip_address INET field

---

### v0.3.0 — Database Architecture: RLS & Roles
**File:** `supabase/migrations/0002_rls.sql`
- Implemented `current_user_role()` — SECURITY DEFINER, reads profiles.active_role
- Implemented `fn_switch_role(target_role)` — validates against user_roles, raises ROLE_NOT_ASSIGNED
- Enabled RLS on all 24 tables — zero DELETE policies (soft-delete only)
- Back-office tables: SELECT for OWNER+SALES; INSERT/UPDATE for OWNER only
- Front-office tables: SELECT/INSERT/UPDATE for OWNER+SALES
- documents: SELECT/INSERT both; UPDATE (void) OWNER only
- audit_logs: SELECT OWNER only; REVOKE insert/update/delete from anon+authenticated
- Added actor_role column to audit_logs
- Added BEFORE INSERT trigger fn_set_audit_actor_role()

---

### v0.4.0 — Database Architecture: Business Logic RPCs
**File:** `supabase/migrations/0003_functions.sql`
All functions LANGUAGE plpgsql SECURITY DEFINER:
- fn_refresh_inventory(product_id)
- fn_record_payment(sale_id, amount, method, reference) — full atomic payment engine
- fn_create_install_job(sale_id, serial_id)
- fn_schedule_installation(job_id, date, installer_id)
- fn_complete_installation(...) — CHECKLIST_INCOMPLETE + SIGNATURE_REQUIRED gates; warranty activation with make_interval(months=>duration); installer payout snapshot
- fn_issue_refund(payment_id, amount, reason) — OWNER-only; INSTALLATION_COMPLETE_NO_REFUND gate
- fn_receive_stock(product_id, serial_numbers[], received_by)
- fn_settle_obligation(obligation_id, amount, method)
- fn_void_document(document_id, reason, actor_id)

---

### v0.5.0 — Database Architecture: Views & Seed Data
**File:** `supabase/migrations/0004_views_seed.sql`
- Views: v_cash_position (running balance), v_stock_dashboard (days_of_stock, restock_status), v_pipeline_summary (6 stages)
- Seeded system_settings: company details, ecocash_enabled=false, installer_fee=50.00, company_install_cut=20.00, referral_commission_flat=10.00
- Seeded warranty_terms version v1.0-2026 with four T&C clauses
- Seeded products: GH-12L ($150), GH-16L ($220), GH-20L ($280), SVC-INSTALL ($70), SVC-PARTS, valve, ignition box, battery

---

### v0.6.0 — PDF Generation Edge Function
**Files:** `supabase/functions/generate-pdf/index.ts`, `templates/receipt-v1.0.html`, `templates/invoice-v1.0.html`, `templates/warranty-v1.0.html`
- Deno Edge Function: accepts {document_id, template_name}; authenticates; fetches linked records; renders PDF via Puppeteer; uploads to storage; updates documents.file_reference; returns {url}
- Receipt: serial number column, verbatim T&C clauses, non-VAT notice
- Invoice: A4, navy/amber palette, Rafiki branding
- Warranty certificate: serial, model, customer, install date, computed expiry

---

### v0.7.0 — TypeScript Types & RPC Wrappers
**Files:** `src/types/database.ts`, `src/lib/rpc.ts`, `src/lib/supabase.ts`
- Complete Database type interfaces for all 24 tables
- 8 typed RPC wrappers: recordPayment, scheduleInstallation, completeInstallation, issueRefund, receiveStock, settleObligation, voidDocument, switchRole
- Typed Supabase client via Database generic

---

### v0.8.0 — Auth & Role Hooks
**Files:** `src/hooks/useAuth.ts`, `src/hooks/useRole.ts`
- useAuth: Supabase session tracking via onAuthStateChange
- useRole: reads profiles.active_role; exposes isOwner, switchRole()

---

### v0.9.0 — App Shell & Auth Flow
**Files:** `src/components/layout/AppShell.tsx`, `src/components/layout/RoleSwitcher.tsx`, `src/pages/Login.tsx`, `src/App.tsx`
- AppShell: responsive sidebar + topbar; sections Command Centre / Commercial / Finance / Operations / Reporting / Admin; global search; "＋ New Sale" button; mobile-collapsible sidebar
- RoleSwitcher: dropdown role switcher; hides Admin + owner-only nav for non-owners
- Login: Supabase email/password sign-in with Rafiki branding
- App.tsx: protected routes; redirect to /login when unauthenticated

---

### v0.10.0 — Dashboard Page
**File:** `src/pages/Dashboard.tsx`
- KPI cards from views: sales count, revenue, cash collected, installations
- Attention queue: obligations due, today's installs, expiring quotes, low stock
- Pipeline snapshot from v_pipeline_summary
- Stock table from v_stock_dashboard; REORDER NOW badge; "No sales yet" for zero-velocity

---

### v0.11.0 — New Sale Form
**File:** `src/pages/NewSale.tsx`
- 5-section mobile-first form: Customer, Items, Installation, Payment, Confirm
- UNIT SKUs: serial selector (AVAILABLE only); PRE-ORDER fallback when stock = 0
- EcoCash hidden (ecocash_enabled=false); live PAID/PARTIAL/UNPAID chip
- Confirm modal listing all consequences; calls supabase.rpc chain
- Post-success: WhatsApp share with pre-filled message; non-VAT disclaimer

---

### v0.12.0 — Sale Workspace
**File:** `src/pages/SaleWorkspace.tsx`
- Tabs: OVERVIEW, ITEMS, PAYMENTS, INSTALLATION, DOCUMENTS, AUDIT
- Record Payment calls fn_record_payment; Schedule calls fn_schedule_installation
- Owner-only: Issue Refund (Clause 3 gate), Void Document

---

### v0.13.0 — Inventory Page
**File:** `src/pages/Inventory.tsx`
- v_stock_dashboard table; REORDER NOW badge; "No sales yet" for zero-velocity SKUs
- Serial drill-down: click SKU to list serial units with status badges
- Owner-only Receive Stock modal: paste serials + date; calls fn_receive_stock

---

### v0.14.0 — Installations Field Workflow
**File:** `src/pages/Installations.tsx`
- Job list with status badges
- Mobile-first one-handed field detail: serial, customer contact, 4-item compliance checklist (large tap-targets), signature reference, photo upload, notes
- Completion calls fn_complete_installation; blocks on CHECKLIST_INCOMPLETE / SIGNATURE_REQUIRED
- Success screen shows auto-computed 6-month warranty expiry date

---

### v0.15.0 — Customers, Warranties & Documents
**Files:** `src/pages/Customers.tsx`, `src/pages/Warranties.tsx`, `src/pages/Documents.tsx`
- Customers: directory + Customer-360 detail (sales + installations + warranties + lifetime spend + outstanding balance)
- Warranties: ledger with serial search; expiry always computed server-side
- Documents: searchable list; View/Download; Share via WhatsApp; Owner-only Void (fn_void_document)

---

### v0.16.0 — Reports Page & xlsx Export
**File:** `src/pages/Reports.tsx`
- Weekly Snapshot: units sold, installed, stock remaining, cash collected (all from views)
- Investor Snapshot (OWNER only): cash position, gross margin by SKU, pipeline breakdown
- "Export Tracker (.xlsx)" — 5-tab workbook: Stock Tracker, Sales Pipeline, Cash & Capital, Install Scheduler, Customer & Warranty

---

### v0.17.0 — PWA & Offline Mode
**Files:** `vite.config.ts`, `src/hooks/useNewSaleDraft.ts`, `src/components/ui/InstallPrompt.tsx`, `src/pages/NewSale.tsx`
- Workbox: precache app shell; NetworkFirst for Supabase API (reads work offline, 6s timeout); CacheFirst for fonts; skipWaiting+clientsClaim
- PWA shortcuts: "New Sale" and "Installations" from phone home screen
- useNewSaleDraft: native IndexedDB (localStorage fallback); 400ms debounced writes; clearDraft on submission
- OfflineBanner: amber top bar when offline
- ReconnectedToast: emerald pill when connectivity restored

---

### v0.18.0 — Document Rendering & Issuance Services
**Files:** `supabase/functions/generate-pdf/templates/warranty-v1.0.html`, `src/lib/pdf.ts`, `src/lib/documents.ts`
- Refreshed the warranty certificate template with the supplied certificate layout, serial callout, installation dates, warranty terms, signatures, and non-VAT notice
- Added shared template hydration, PDF rendering, Supabase Storage upload, and sale line-item HTML helpers
- Added typed receipt, invoice, and warranty certificate issuance services using server-side document numbering via `fn_issue_document`
- Adapted document hydration to the current schema fields and linked generated PDFs through `documents.file_reference`
- InstallPrompt: beforeinstallprompt card (dismissed state in localStorage)
- NewSale: resume banner + "Auto-saving to device" indicator

---

---

### v0.18.0 — RLS Replacement (Authoritative Version)
**File:** `supabase/migrations/0002_rls.sql`
**Date:** 2026-08-26
- Replaced auto-generated RLS file with user-supplied authoritative version
- `current_user_role()` — `LANGUAGE sql SECURITY DEFINER STABLE` (more efficient than plpgsql)
- `fn_switch_role(p_role)` — validates via `user_roles` table; raises `ROLE_NOT_ASSIGNED`; writes audit log entry with `ROLE_SWITCHED` action
- `fn_set_audit_actor_role()` trigger — `BEFORE INSERT` on `audit_logs`; auto-fills `actor_role` from `current_user_role()` when NULL
- **Back-office tables (14):** `products`, `serial_numbers`, `installers`, `referral_partners`, `installations`, `installation_parts`, `warranties`, `warranty_terms`, `inventory`, `inventory_movements`, `obligations`, `cash_movements`, `refunds`, `system_settings` — enabled via `DO $$` loop; SELECT for OWNER+SALES; INSERT/UPDATE for OWNER only
- **Front-office tables (7):** `customers`, `enquiries`, `quotes`, `quote_items`, `sales`, `sale_items`, `payments` — enabled via `DO $$` loop; SELECT/INSERT/UPDATE for OWNER+SALES
- **`documents`:** SELECT/INSERT for OWNER+SALES; UPDATE (void) for OWNER only
- **`audit_logs`:** SELECT for OWNER only; `REVOKE INSERT, UPDATE, DELETE FROM anon, authenticated` — no direct writes possible
- **`profiles`:** users can read their own row; OWNER can read/write all
- **`user_roles`:** users can read their own assignments; OWNER can manage all

---

### v0.19.0 — Functions Replacement (Authoritative Version)
**File:** `supabase/migrations/0003_functions.sql`
**Date:** 2026-08-26
- Replaced auto-generated RPC functions file with user-supplied authoritative version
- `fn_refresh_inventory(p_product_id)` — recomputes serialized & non-serialized stock counts atomically
- `fn_create_install_job(p_sale_id, p_serial_id)` — creates installation job and pending warranty record
- `fn_record_payment(...)` — locks sale row (`FOR UPDATE`), checks EcoCash gate from `system_settings`, computes status/balance, records cash movement, reserves serials & creates install job on first payment
- `fn_schedule_installation(...)` — sets status to `SCHEDULED`, updates serial status to `ALLOCATED`, refreshes inventory
- `fn_complete_installation(...)` — checklist and signature enforcement, updates serial to `INSTALLED`, logs inventory movement, reads default warranty duration from settings and activates warranty, records installer payout obligation
- `fn_issue_refund(...)` — OWNER-only enforcement, Clause 3 gate (`INSTALLATION_COMPLETE_NO_REFUND`), partial/full refund calculation, serial release to `AVAILABLE` on full refund
- `fn_receive_stock(...)` — bulk serial ingestion with `PURCHASE` movement logging
- `fn_settle_obligation(...)` — OWNER-only settlement with `SUPPLIER_PAYMENT` cash movement
- `fn_void_document(...)` — OWNER-only document voiding with audit log
- Added `fn_sweep_warranty_expiry()` and `fn_sweep_quote_expiry()` for pg_cron nightly sweeps

---

### v0.20.0 — Views & Seed Replacement (Authoritative Version)
**File:** `supabase/migrations/0004_views_seed.sql`
**Date:** 2026-08-26
- Replaced auto-generated views & seed SQL with user-supplied authoritative version
- `v_cash_position`: Window function calculating cumulative `running_balance` across `cash_movements`
- `v_stock_dashboard`: Calculates `days_of_stock_remaining` based on 28-day sales velocity and flags `restock_status` (`NO_SALES_YET`, `REORDER_NOW`, `OK`)
- `v_pipeline_summary`: Aggregates the 6 commercial pipeline stages (`Enquiry`, `Quoted`, `Deposit Paid`, `Scheduled`, `Installed`, `Warranty Registered`)
- Seeded `system_settings`: Locked business configuration (legal name, tagline, WhatsApp number, EcoCash disabled, USD, non-VAT, installer split, referral commission)
- Seeded `warranty_terms`: Canonical v1.0-2026 T&C clauses (warranty, liability, returns, handover)
- Seeded `products`: Working SKU catalogue (GH-12L, GH-16L, GH-20L with landed cost prices for margin tracking, SVC-INSTALL, SVC-PARTS, parts)
- Seeded `obligations`: Initial capital commitments (factory balance, freight/duty, investor return Option A)
- Seeded `cash_movements`: Capital base deployment ($4,409.00 IN) and factory production deposit ($874.50 OUT)
- Seeded initial `inventory` placeholders and primary `installers` record

---

## Pending / Known Issues

- **DocTypeEnum mismatch:** `src/types/database.ts` uses `'WARRANTY'` and `'INSTALLATION_CERT'` — must be updated to `'WARRANTY_CERTIFICATE'` and `'INSTALLATION_REPORT'` to match authoritative 0001_schema.sql
- **Documents.tsx seed data** uses `'WARRANTY'` string — needs same correction once DocTypeEnum is fixed
- **Stub pages:** Enquiries, Quotes, Payments (standalone), Settings — not yet implemented
