# Rafiki Operations Desk — User Manual

**For:** Rafiki Thermal Solutions team members

**Location:** Harare, Zimbabwe  
**Currency:** USD  
**Timezone:** Africa/Harare (the database stores timestamps in UTC)

> This manual describes the controls currently implemented in the application. The database is the source of truth: always use the values shown after a refresh, not personal calculations or paper notes.

## 1. Before you begin

You need:

- An active Rafiki Operations Desk account and password.
- A reliable internet connection when saving records, recording payments, uploading photos, or generating documents.
- The customer’s correct name, phone number, address, and city.
- For a stocked geyser sale, the correct product and physical serial number.
- For a payment, the amount, method, and bank/card/cash reference where available.

All prices are in USD. Rafiki Thermal Solutions is not VAT-registered; do not add VAT manually.

## 2. Sign in and choose your role

1. Open the Operations Desk URL.
2. Enter your email address and password.
3. Select **Sign In to Operations Desk**.
4. Confirm that the dashboard loads.
5. If your account has more than one assigned role, use the **Role** selector in the top bar. The selected role is saved server-side.
6. Select **Sign out** when finished, especially on a shared phone or computer.

Roles are enforced by the database, not only by hiding buttons:

| Role | Normal responsibilities | Owner-only controls |
|---|---|---|
| OWNER | Full operational and financial oversight | Receive stock, refunds, document voids, reports, settings, role administration |
| SALES | Customers, sales, payments, customer follow-up | Cannot use owner-only financial/inventory controls |
| OPERATIONS | Installation and field fulfilment | Cannot create sales or use owner-only controls |

Both founders are OWNER. If a required action is unavailable, switch only to a role that is genuinely assigned to you or contact an OWNER.

## 3. Understand the main navigation

- **Dashboard:** daily operational snapshot, attention items, pipeline, stock, and cash indicators.
- **Customers:** active customer directory and customer history.
- **Sales:** sale search and the complete sale workspace.
- **＋ New Sale:** create a customer/sale transaction.
- **Inventory (Serials):** stock dashboard, serial statuses, and owner-only stock receiving.
- **Installations:** installation jobs and their field completion screens.
- **Warranties:** active, expiring, and expired warranty register.
- **Documents / Receipts:** issued documents and available sharing/void controls.
- **Reports & Margins:** OWNER-only live reporting and XLSX tracker export.

The **Enquiries**, **Quotes**, **Payments** (standalone), and **System Settings** links currently open placeholder workspaces. Do not assume that an enquiry or quote has been persisted there; use the supported customer and sale workflows until those workspaces are implemented.

## 4. Create a customer

1. Open **Customers**.
2. Select **New Customer**.
3. Enter the customer’s first name (required), last name, phone (required), email, address, and referral source.
4. Check spelling and phone digits carefully.
5. Select **Create** once.
6. Wait for the modal to close and confirm the customer appears in the directory.
7. Select the customer row to open Customer 360 and review history.

If the request is for a new sale, the New Sale screen can also create the customer as part of submission. Avoid creating a duplicate customer first unless you have searched the directory.

## 5. Create a new sale

### 5.1 Start and identify the customer

1. Select **＋ New Sale**.
2. Enter the customer’s full name and phone number.
3. Enter or confirm the installation/site address.
4. Review any restored draft shown by the screen. Drafts are saved locally on the device; discard an old draft before starting a different customer.

### 5.2 Add the geyser and serial

1. In **Select Geyser / SKU**, choose the correct active geyser product.
2. Confirm the price displayed from the catalogue.
3. In **Available Serials**, choose the physical unit that will be sold.
4. Check the serial number on the box/unit against the selected value.
5. Select **Add Unit**.
6. If no serialised unit is available, use **Record Pre-Order** only when the customer has agreed to a pre-order. A pre-order does not allocate a serial.
7. Confirm every line item shown below the selectors.

Never type a price from memory or substitute another serial. Quotes do not consume stock; the first confirmed payment reserves a serial.

### 5.3 Installation and parts

1. Leave **Standard Installation Labour** selected when Rafiki is providing installation.
2. Enter any approved parts amount in **SVC-PARTS Amount**.
3. Confirm the address and installer/referral information.
4. Do not use the referral options unless the partner is genuinely responsible for the referral.

The screen displays a calculated grand total. Because the current sale RPC does not yet persist installation and parts as separate sale lines, treat this area as a known control limitation and verify the persisted sale total in the Sale Workspace before relying on the invoice.

### 5.4 Take payment (optional)

1. Enter the amount received now. Use `0` when no payment has been received.
2. Select **Cash**, **Bank Transfer**, or **Card / POS**.
3. Enter the payment reference or note when one exists. For retry safety, reuse the same reference rather than creating a new reference.
4. Check the displayed status: **UNPAID**, **PARTIAL**, or **PAID**.
5. Do not deliberately overpay unless an OWNER has confirmed how overpayments should be handled.

### 5.5 Confirm

1. Select **Review & Confirm Commercial Sale**.
2. Read the confirmation list, including customer, invoice, payment, serial, referral, and installation consequences.
3. Correct any mistake using **Cancel / Edit**.
4. Select **Confirm & Issue Sale** once.
5. Wait for the button to finish. Do not refresh or click again while it says **Executing RPC...**.
6. On success, record the invoice number and any receipt number.
7. Open **View Sales Workspace** and refresh the sale before telling the customer the transaction is complete.

If a payment or document fails after the sale was created, do not resubmit the entire sale. Open the Sale Workspace, verify the payment/sale state, and ask an OWNER to resolve the partial workflow.

## 6. Review a sale and record another payment

1. Open **Sales** and select the sale, or use the global search for its sale number, customer, phone, or serial.
2. In **Overview**, confirm total, paid amount, balance due, payment status, customer, and fulfilment status.
3. In **Items**, verify the product, quantity, unit price, total, and serial.
4. Open **Payments** and select **Record Payment**.
5. Enter the amount received, payment method, and reference.
6. Select **Confirm** once.
7. Confirm the new payment appears in the ledger after refresh and that the balance/status changed correctly.

Every payment is a separate event. Do not edit an old payment to represent a later receipt. If a duplicate submission may have occurred, stop and ask an OWNER to check the ledger before trying again.

## 7. Handle inventory and serials (OWNER)

### Receive stock

1. Open **Inventory (Serials)**.
2. Select **Receive Stock**.
3. Choose the product.
4. Enter one serial per line exactly as printed on the unit. The required format is `GH-{SKU}-{sequence}`, for example `GH-12L-001`.
5. Select the receiving date.
6. Select **Receive** once.
7. Confirm the available count and serial list after refresh.

Duplicate serials are rejected or ignored by the database. Never reuse a serial for a replacement unit.

### Read serial status

Select a product row to open its serial drill-down. The normal lifecycle is:

`AVAILABLE → RESERVED → ALLOCATED → INSTALLED`

`RETURNED`, `DAMAGED`, and `SCRAPPED` are exception states. Do not manually make an installed, reserved, or damaged unit available. Record the reason through the approved OWNER workflow.

## 8. Schedule and complete an installation

### Schedule

1. Open **Installations**.
2. Select the job linked to the sale.
3. Confirm the customer, address, product, serial, and assigned installer.
4. Use the scheduling control available from the sale/installation workflow to set the date and installer.
5. Confirm the job shows **SCHEDULED** and the serial shows **ALLOCATED**.

Do not promise a customer an installation date until the job and installer assignment are visible in the system.

### Complete in the field

1. Open the scheduled job from **Installations**.
2. Confirm the customer, phone, address, product, serial, and installer before starting work.
3. Complete all four checklist items: gas safety test, water/pressure test, unit operational test, and customer handover.
4. Upload clear installation photos, if required.
5. Capture the customer signature using the signature pad.
6. Add concise installer notes, including any rework or exception.
7. Select **Complete Installation** once.
8. Wait for confirmation. The completion RPC requires a payment before installation can be completed.
9. Confirm the job is **COMPLETED**, the serial is **INSTALLED**, and the warranty certificate/expiry is shown.

Never mark a checklist item complete if the test was not performed. Do not complete an unpaid installation; escalate payment issues to SALES/OWNER.

## 9. Check warranties

1. Open **Warranties**.
2. Search by warranty number, serial number, or customer.
3. Use **ACTIVE**, **EXPIRING**, or **EXPIRED** filters.
4. Confirm the start date is the installation date, not the sale date.
5. Confirm the expiry is six months from installation under the current terms.
6. OWNER users may add service notes. Save notes only after checking the serial and customer.

Warranty status must not be activated manually before installation. After installation, use the warranty certificate linked to the job and sale.

## 10. View, share, or void documents

1. Open **Documents** or the sale’s **Documents** tab.
2. Search by document number or type.
3. Confirm the customer, sale/payment, amount, serial, and status before sharing.
4. Use the available view/download action to retrieve the document.
5. Use **WhatsApp** only after confirming the recipient phone number.
6. An OWNER may select **Void** and provide a reason. Voiding is permanent financial history; do not void to correct a typo without issuing the correct replacement document.

An invoice represents the sale obligation. A receipt represents money actually received. Never call an invoice a receipt.

## 11. Dashboard and reports (OWNER)

1. Review the Dashboard at the start of each operating day.
2. Check today’s sales, cash, installations, obligations, expiring quotes, and low-stock alerts.
3. Open **Reports & Margins** for the weekly snapshot and operational health.
4. Treat **REORDER NOW** and approximately 30 days of stock remaining as an action signal, then confirm physical stock before ordering.
5. Select **Export Tracker (.xlsx)** for the operations workbook.
6. Compare cash and stock figures with the underlying sale, payment, and inventory records before sharing a report externally.

## 12. Refunds and exceptions (OWNER only)

- Refunds require a positive amount, a reason, and a selected payment.
- Refunds are blocked after an installation is **COMPLETED**. The correct path after completion is a warranty claim, not a refund.
- Never delete a sale, payment, serial, or document to correct an error.
- For duplicate payments, wrong serials, wrong prices, or failed document generation, preserve the records and escalate with the sale/payment/document numbers.

## 13. Common problems and safe responses

| Message/symptom | Safe response |
|---|---|
| `AUTHENTICATION_REQUIRED` | Sign in again; if it persists, contact an OWNER. |
| `FORBIDDEN` | Switch to an assigned role with the required permission; do not bypass the control. |
| `SERIAL_UNAVAILABLE` or `SERIAL_QC_FAILED` | Stop the sale and check Inventory for the exact physical unit and QC state. |
| `PAYMENT_METHOD_DISABLED` | Use Cash, Bank Transfer, or Card; EcoCash is hidden until enabled by system configuration. |
| `PAYMENT_REQUIRED_BEFORE_INSTALLATION` | Record and verify the required payment before completing the job. |
| `INSTALLATION_COMPLETE_NO_REFUND` | Do not issue a refund; follow the warranty process. |
| Invoice/receipt generation failed | Keep the sale/payment; refresh Documents and ask an OWNER to re-issue or investigate. |
| Screen says success but records look wrong | Refresh the relevant workspace and compare persisted values. Do not submit again. |

## 14. Non-negotiable operating rules

1. Use the database values as the final authority.
2. Never create a second sale because a page appears slow.
3. Never assign one serial to two customers.
4. Never hand-type totals, balances, warranty dates, or payment totals into records.
5. Never delete financial history.
6. Keep sale status separate from payment status.
7. Record every payment separately with a useful reference.
8. Verify customer, serial, amount, and document number before sharing externally.
9. Escalate any business ambiguity to Keith or Thokozani; do not invent a price, discount, refund, or warranty exception.

## 15. Current system limitations

This release has not yet completed an authenticated end-to-end test against a disposable Supabase database. Migration 0009 must be applied and verified before live financial/inventory use. The New Sale workflow also remains under remediation because its browser-side customer, sale, payment, and document calls are not one atomic database transaction, and installation/parts display values are not yet represented as persisted sale lines. Follow the safe-response guidance above until that remediation is complete.
