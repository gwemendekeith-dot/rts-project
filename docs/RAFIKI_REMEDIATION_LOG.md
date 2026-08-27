# Rafiki Remediation Log

## Audit Status

Date: 2026-08-27  
Scope completed: Phases 0-10 initial audit  
Code remediation performed during this audit: none, per instruction.  
Documentation created: `RAFIKI_SYSTEM_AUDIT.md`, `RAFIKI_REMEDIATION_LOG.md`, `RAFIKI_ARCHITECTURE_AS_BUILT.md`.

## Findings Requiring Remediation

| ID | Priority | Area | Root cause | Current status |
|---|---|---|---|---|
| P0-01 | P0 | RPC security | `SECURITY DEFINER` functions lack explicit authenticated caller checks and complete authorization guards. | Open |
| P0-02 | P0 | API/PDF security | PDF endpoints accept requests without demonstrated auth; Vercel endpoint accepts arbitrary HTML. | Open |
| P0-03 | P0 | Documents | Supabase Edge Function emits mock PDF bytes and uses stale document columns. | Open |
| P0-04 | P0 | Sales/finance | New Sale customer insert conflicts with schema, ignores error, and falls back to fake customer ID. | Open |
| P1-01 | P1 | Sales/finance | Client sends prices/discounts and omits installation labour/parts from sale RPC. | Open |
| P1-02 | P1 | Documents | Browser document service uses stale settings, sale, payment, and document field names. | Open |
| P1-03 | P1 | Lifecycle | Sale/payment/document/storage operations are not one atomic business transaction and have no compensation workflow. | Open |
| P1-04 | P1 | Payment | No idempotency key for retry-safe payment recording. | Open |
| P1-05 | P1 | Inventory | Duplicate serial receiving still inserts purchase movements. | Open |
| P1-06 | P1 | Inventory | Days-of-stock velocity does not clearly exclude cancelled/preorder/non-stock sales. | Open |
| P1-07 | P1 | Serial lifecycle | Manual status adjustment allows invalid transitions and leaves associations unchanged. | Open |
| P1-08 | P1 | Installation | Scheduling/completion have weak state, ownership, installer, and audit guards. | Open |
| P1-09 | P1 | Warranty | Warranty activation can commit while certificate generation fails; terms snapshot is incomplete. | Open |
| P1-10 | P1 | Product completeness | Enquiries, Quotes, standalone Payments, and Settings routes are stubs. | Open |
| P2-01 | P2 | Data contract | Generated TypeScript types are stale and code relies on `unknown` casts. | Open |
| P2-02 | P2 | Documents | HTML template values are not escaped. | Open |
| P2-03 | P2 | Operations | PWA manifest references missing icon assets. | Open |
| P2-04 | P2 | Testing | No automated test script, database harness, or E2E test suite. | Open |

## Recommended Remediation Order

1. Revoke public EXECUTE where appropriate and add explicit `auth.uid()` checks to every exposed `SECURITY DEFINER` function.
2. Choose one PDF architecture, authenticate it, remove mock rendering, and align all document columns with the authoritative schema.
3. Repair the New Sale contract using the customer RPC and server-derived product pricing; include configured labour/parts through an approved server-side model.
4. Generate fresh Supabase TypeScript types and remove stale casts/field names.
5. Add payment idempotency and safe retry behavior.
6. Add strict serial transition rules, duplicate receiving protection, and auditable inventory movements.
7. Add installation state guards and complete the schedule/assignment/report workflow.
8. Add automated SQL/RPC tests and authenticated browser tests against an isolated database.

## Verification Requirements

A remediation item is not complete until the relevant SQL or UI behavior is reproduced before the fix, the fix is tested in an isolated environment, and the resulting persisted state is asserted. A successful TypeScript build alone is insufficient.

## Checks Run

- `npm run build`: passed.
- `npm run lint`: completed with warnings.
- `npm test`: unavailable because no test script exists.
- Supabase CLI: unavailable in PATH.
- Browser/database end-to-end tests: not run because no shared browser session, authenticated test account, or isolated resettable database was available.
