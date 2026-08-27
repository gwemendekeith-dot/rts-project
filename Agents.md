# AGENTS.md — Rafiki Operations Desk

## What you are building
An integrated operations system for **Rafiki Thermal Solutions**, a Zimbabwe residential
gas-geyser business run by two co-founders (Keith and Thokozani). It is NOT a generic
POS/invoicer. It is the operational source of truth connecting: CRM, enquiries, quotes,
sales, invoices, receipts, payments, inventory, serial numbers, installation scheduling,
installation completion, warranty registration, documents, reporting, and audit logs.
Every commercial/operational transaction must automatically update the database.

## The single most important principle
**The database is the source of truth. Documents are generated VIEWS of database records.**
Never maintain sale totals, balances, inventory, warranty dates, or payment totals in the UI.
Compute them server-side. If a document and the database disagree, the database wins.

## Locked business decisions (do NOT change these without asking)
- Legal name: **Rafiki Thermal Solutions**. Tagline: "Hot Water on The Go, Smart Living".
- Location: Harare, Zimbabwe. WhatsApp: **+263 71 466 9128**.
- Currency: **USD only**. Timezone: **Africa/Harare** (store UTC, display local).
- **Not VAT-registered** → no VAT line; every document shows:
  "Prices in USD. Rafiki Thermal Solutions is not VAT-registered."
- Working prices: **12L = $150, 16L = $220, 20L = $280. Install labour = $70. Parts at cost.**
  Prices are configurable in `products`; NEVER hard-code. Every sale item snapshots its price.
- **Serial format: GH-{SKU}-{seq}** (e.g. GH-12L-001). Serialised units only.
- Document numbers are type-prefixed, per-type sequences:
  RTS-QTE-YYYY-NNNN, RTS-INV-YYYY-NNNN, RTS-RCP-YYYY-NNNN, RTS-WTY-YYYY-NNNN, RTS-INS-YYYY-NNNN.
- Install labour split: **$50 to installer, $20 to company** (snapshot at completion).
- Referral commission: **flat $10 per sale**, accrues when payment_status = PAID.
- **Both founders are OWNER.** Roles are switchable (OWNER / SALES / OPERATIONS) via
  `profiles.active_role` + `user_roles`. Audit logs capture `actor_role`.
- **EcoCash is HIDDEN** until `system_settings.ecocash_enabled = true`. Payment methods
  shown by default: Cash, Bank Transfer, Card.
- Warranty: **6 months from INSTALLATION date (never sale date)**. Expiry auto-calculated.
- **Refund gate (T&C Clause 3):** no refunds once an installation is COMPLETED
  (only warranty claims after that). Raise `INSTALLATION_COMPLETE_NO_REFUND`.
- Quotes do not reduce stock. A confirmed sale reserves serials. Serial lifecycle:
  AVAILABLE → RESERVED (first payment) → ALLOCATED (scheduled) → INSTALLED (handover).

## Non-negotiable engineering rules
1. Never duplicate financial truth. 2. Never hard-code changing commercial values.
3. Never delete financial history (soft delete / void / reversal + audit).
4. Never overwrite historical transaction values silently (snapshot prices at sale).
5. Documents are never independent sources of truth.
6. A serial can never be assigned to two active sales.
7. Balances and warranty expiry are ALWAYS computed, never hand-typed.
8. Keep sale status separate from payment status. 9. Keep sales separate from installations.
10. Preserve audit history. 11. Design for multiple installers. 12. Multiple payment methods.
13. Configurable products/pricing. 14. Design for future warranty claims (don't build V2 now).
15. Do not over-engineer V1.
All multi-step mutations MUST be atomic (single transaction, rollback on failure).

## Tech stack (locked)
- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, React Router, TanStack Query,
  React Hook Form + Zod, Zustand (state), vite-plugin-pwa, SheetJS (xlsx export), date-fns.
- **Backend:** Supabase — Postgres, Auth, Storage, Edge Functions, Realtime.
- **PDF:** Supabase Edge Function using Puppeteer/Playwright to render HTML templates.
- All business mutations go through Postgres RPC functions (SECURITY DEFINER). The UI calls
  `supabase.rpc('fn_...')` and never writes financial tables directly (RLS enforces this).

## Data model summary (24 tables)
Config: system_settings, warranty_terms, profiles, user_roles
People: customers, installers, referral_partners
Catalogue: products, serial_numbers
Intake: enquiries, quotes, quote_items
Sales: sales, sale_items, payments, refunds
Fulfilment: installations, installation_parts, warranties
Inventory: inventory, inventory_movements
Finance: obligations, cash_movements
Docs/Audit: documents, audit_logs

Views: v_cash_position, v_stock_dashboard, v_pipeline_summary
Key RPCs: fn_record_payment, fn_create_install_job, fn_schedule_installation,
  fn_complete_installation, fn_issue_refund, fn_receive_stock, fn_settle_obligation,
  fn_void_document, fn_switch_role, fn_refresh_inventory, fn_next_number, current_user_role

## File structure
rafiki-ops-desk/
├─ AGENTS.md
├─ public/ (logo.png, manifest handled by vite-plugin-pwa)
├─ src/
│  ├─ components/{layout,ui,sale,inventory,install}
│  ├─ hooks/ (useAuth, useSupabase, useRole)
│  ├─ lib/ (supabase.ts, rpc.ts, pdf.ts, xlsx.ts)
│  ├─ pages/ (Dashboard, NewSale, SaleWorkspace, Inventory, Installations,
│  │          Warranties, Customers, Documents, Reports, Settings)
│  ├─ types/ (database.ts — generated from Supabase)
│  └─ App.tsx, main.tsx
└─ supabase/
   ├─ migrations/ (0001_schema.sql, 0002_rls.sql, 0003_functions.sql, 0004_views_seed.sql)
   └─ functions/generate-pdf/{index.ts, templates/*.html}

## Definition of done (for every task)
- TypeScript compiles with no errors (`npm run build` passes).
- No `any` types on Supabase data; use generated `Database` types.
- All financial reads come from views/RPCs; all financial writes via `supabase.rpc`.
- New UI must be mobile-first (field use happens on phones).
- Respect role gating: hide/disable owner-only actions when active_role ≠ OWNER.
- Do not invent business rules not listed above; if unsure, ASK before implementing.