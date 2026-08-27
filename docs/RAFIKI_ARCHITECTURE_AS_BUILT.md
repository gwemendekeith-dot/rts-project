# Rafiki Operations Desk — Architecture As Built

## Runtime Shape

The application is a Vite-built React SPA. `src/main.tsx` creates a TanStack Query client and mounts `App` into the `root` element from `index.html`.

`src/App.tsx` owns the browser router. `/login` is public. All other routes enter `ProtectedLayout`, which uses Supabase session state from `useAuth()` and redirects unauthenticated users to `/login`. Page modules are loaded lazily with React `Suspense`.

Authenticated screens render inside `AppShell`, which supplies navigation, search, role switching, and sign-out. The shell also renders the offline/PWA overlays.

## Frontend Boundaries

- `src/pages/`: route-level screens and workflow handlers.
- `src/components/`: shared layout, installation signature, inventory, and UI pieces.
- `src/hooks/useAuth.ts`: Supabase session restoration and auth-state subscription.
- `src/hooks/useRole.ts`: profile role query and role-switch RPC wrapper.
- `src/hooks/useRole.tsx`: a second, unused context-based role implementation; this is an architectural duplicate.
- `src/hooks/useNewSaleDraft.ts`: IndexedDB-first New Sale draft persistence with localStorage fallback.
- `src/hooks/useOfflineDraft.ts`: generic localStorage draft hook.
- `src/lib/supabase.ts`: browser Supabase client using Vite environment variables.
- `src/lib/rpc.ts`: frontend wrappers for database business functions.
- `src/lib/documents.ts`: browser-side document issuance/render/upload orchestration.
- `src/lib/pdf.ts`: HTML hydration, Vercel PDF call, Storage upload, and HTML row generation.
- `src/lib/xlsx.ts`: five-sheet live operations export.

## Data and Mutation Boundaries

Reads are issued from page components using Supabase table and view queries. The main summary reads are `v_dashboard`, `v_stock_dashboard`, `v_pipeline_summary`, and `v_cash_position`.

Mutations are split between direct table writes and RPC calls. The intended business engine is in PostgreSQL `SECURITY DEFINER` functions, but the current frontend still directly inserts customers in `NewSale.tsx` and directly updates warranty service notes in `Warranties.tsx`.

## Database Layers

- `0001_schema.sql`: tables, enums/checks, foreign keys, sequences, and document cardinality constraints.
- `0002_rls.sql`: role lookup, role switching, RLS policies, and audit actor trigger.
- `0003_functions.sql`: inventory refresh, payment, installation, refund, receiving, obligation, document void, and sweep functions.
- `0004_views_seed.sql`: cash, stock, and pipeline views plus seeded settings/products/opening data.
- `0005_documents.sql`: document number issuance function.
- `0006_sale_and_dashboard.sql`: sale creation function and dashboard view replacement.
- `0007_customers_and_serial_ops.sql`: customer creation and serial QC/status functions.

## Actual Major Workflows

### Customer

`Customers.tsx` validates a form with Zod and calls `fn_create_customer`. The customer list and Customer 360 screens read customer, sale, installation, and warranty records.

### New Sale

`NewSale.tsx` loads products and available serials, constructs client-side line items, directly inserts a customer, calls `fn_create_sale`, optionally calls `fn_record_payment`, then attempts receipt and invoice generation. The database function creates the sale and items and writes a sale audit row. The browser-side chain is not atomic.

### Payment

`SaleWorkspace.tsx` calls `recordPayment()`, which calls `fn_record_payment`. The function locks the sale, inserts payment/cash records, recalculates stored sale payment fields, reserves serialized units on first payment, optionally creates an installation job, and writes an audit record.

### Inventory

`Inventory.tsx` reads the stock view and serial rows. Owner actions call serial QC, serial status adjustment, and stock receiving RPCs. The database derives serialized counts from serial status but also records movement events, so both models must remain reconciled.

### Installation

`Installations.tsx` lists jobs. `InstallationDetail.tsx` uploads photos and a customer signature, then calls `fn_complete_installation`. Completion updates the job, serial, inventory, movement history, warranty, sale fulfilment status, installer payout, and audit log. Certificate generation happens afterward in a separate call.

### Warranty

A pending warranty is created with an installation job. Installation completion sets it active from `CURRENT_DATE` using the configured duration. `issueWarrantyCertificate()` then attempts to produce a customer-facing certificate.

### Documents

There are two implementations: the Vercel API route `/api/render-pdf`, used by browser services, and the Supabase Edge Function `generate-pdf`, which is an older conflicting implementation. The database document row is intended to be the source link, with the PDF stored in Supabase Storage.

### Reporting

`Reports.tsx` reads current dashboard/stock/obligation values. `src/lib/xlsx.ts` fetches live stock, sales, payments, cash, installation, and warranty data and writes five workbook tabs.

## External Integrations

- Supabase Auth: login/session.
- Supabase Postgres: source of truth and RPC business logic.
- Supabase Storage: PDFs, signatures, and installation/receiving photos.
- Vercel Node function: Puppeteer/Chromium PDF rendering.
- Supabase Edge Function: legacy/conflicting PDF path.
- WhatsApp deep links: document sharing.
- Workbox/PWA: app-shell and runtime caching.

## Architectural Risks Found

1. Authoritative SQL and TypeScript field models are out of sync.
2. Two role hook implementations exist, with no visible `RoleProvider` mounted in `App`.
3. Two PDF architectures exist and disagree about document columns and rendering responsibility.
4. Several security-definer functions lack explicit caller authentication checks.
5. The main sale workflow is a client-side saga without durable idempotency or compensation.
6. Placeholder routes prevent the documented enquiry-to-quote-to-sale lifecycle from being completed in the UI.
7. There is no automated test harness for the database transaction model.
