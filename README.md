# SSTE Studio

A React storefront backed by an Express API and PostgreSQL for customers in India. Prices use Indian rupees (INR); checkout collects an Indian mobile number, delivery address, state/union territory, and six-digit PIN code. The final checkout step offers a test-only UPI success/failure simulation; it does not contact a bank or UPI app or move money. Customers can create accounts, review orders, contact customer care, reply to support tickets, and leave feedback on paid orders. Product, inventory, analytics, support, and feedback management require a separate owner session.

Watch the [animated SSTE Studio product film](./public/business-owner-demo.webm), a roughly 55-second, silent 16:9 tour of the storefront and owner workflows. Interface scenes use illustrative sample values, not live store or customer data. See the [film preview and renderer](./public/business-owner-demo-preview.html) for a preview of the motion design.

## Local setup

```bash
npm install
```

Create a PostgreSQL role and database using pgAdmin or `psql`:

```sql
CREATE ROLE sste_app WITH LOGIN PASSWORD 'replace-with-a-strong-database-password';
CREATE DATABASE sste_store OWNER sste_app;
```

Copy `.env.example` to `.env`, set `DATABASE_URL`, `ADMIN_EMAIL`, and a random `SESSION_SECRET` of at least 32 characters. Generate the session secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Generate the owner password hash in an interactive terminal. The password input is hidden; put the printed hash in `.env` as `ADMIN_PASSWORD_HASH`:

```bash
npm run admin:hash
```

Start the API and Vite together:

```bash
npm run dev
```

Open `http://localhost:5173/` for the storefront, `http://localhost:5173/account` for customer sign-in/registration, order history, support, and feedback, and `http://localhost:5173/admin` for owner sign-in. Customer passwords must be at least 12 characters. On first API startup, the schema and starter products are created automatically; schema migrations add delivery, payment, inventory, support, and feedback data structures to existing databases. PostgreSQL sessions are stored in the database. The owner dashboard includes date-filtered sales and operations KPIs, a daily sales chart, product/region/order breakdowns, inventory alerts and movement history, a support inbox, feedback moderation, Razorpay setup status, and order fulfillment.

## Tests and quality checks

Run the isolated business-rule tests without a running server or database:

```bash
npm run test:unit
```

For the complete automated suite, start PostgreSQL and the app with `npm run dev`, then run this command in another terminal:

```bash
npm test
```

The complete suite includes order/address and customer-credential validation, delivery-state transitions, public API response/privacy contracts, anonymous authorization checks for customer/owner/delivery endpoints, security headers, API error responses, and storefront deep links. API smoke tests use `API_BASE_URL` and `WEB_BASE_URL` when set; defaults are `http://localhost:3000` and `http://localhost:5173`. These smoke tests do not create customer, order, or inventory records. Real Razorpay, Gemini, external messaging, and production payment settlement require provider credentials and are not simulated by this suite.

### Inventory, reporting, and customer care

Inventory tracking is opt-in per product because existing product quantities are unknown. In the owner dashboard, enter an actual physical count and reorder level to begin tracking a SKU; the application creates an individually identified unit record for each counted item, including current tracked stock on schema upgrade. Customers see a simple **In stock** or **Out of stock** status; exact stock counts and inventory controls remain private to the owner. For products not yet tracked, checkout permits orders and the storefront shows them as in stock; enter a verified physical count to make availability reflect real tracked stock. Open **Unique item labels** to show, print, and assign each QR label to its matching physical item. Additional stock-count increases create new unit identities; decreases retire available units and retain their history. Tracked items are reserved transactionally when a Razorpay order is created, unavailable quantities cannot be oversold, and failed or cancelled unpaid orders release the same units. Confirmed payments mark those units sold and link them to the order. Each unit has an auditable event history for opening stock, receipt, reservation, release, sale, and retirement. A simulated UPI payment never represents real collected revenue; the sales report uses captured Razorpay payments only. It also excludes gateway fees, refunds, GST, and operating costs, which are not stored by the current application.

Owner inventory cards and order rows can generate and print record QR labels, and each serialized physical unit has its own unique QR label. A unit label opens and highlights that exact unit in the owner inventory dashboard; its status and recent lifecycle events are visible there. QR payloads contain only the record type and its random internal ID, not customer data. Scanning requires an owner sign-in and never changes stock. Use a deployed HTTPS address (or a LAN-reachable host for local testing) when generating labels intended for phones; `localhost` QR links only open on the device running the app. Scan, verify, and physically attach each generated label to the corresponding item; a count increase creates identities but cannot attach labels to physical products automatically.

### Dispatch and delivery operations

Owners can create separate delivery staff accounts, assign eligible paid orders, and print order and per-unit pickup QR labels from the Logistics desk. Set `STORE_PICKUP_ADDRESS` in the private server environment so staff have the collection location. Staff sign in at `/delivery`; authorization is checked against their active account on every delivery API request, and only their assigned route details are returned. The workflow records individual item pickup scans, pickup, transit, out-for-delivery, delivery exceptions, and delivery completion in an event history. A customer delivery PIN is available only in the signed-in customer's order history and is required from the recipient before a driver can complete delivery. Deactivating a staff account immediately prevents further API access.

This is an internal dispatch workflow, not a carrier integration. No SMS/email delivery notices, live GPS/maps, route optimization, payment-on-delivery, photo/signature proof, or carrier tracking numbers are sent or recorded. Drivers must have network access to the app; configure an HTTPS deployment and a real pickup address before using printed QR links operationally. The delivery PIN is displayed in the customer's account because outbound messaging is not integrated; do not ask the customer to share it before the parcel is physically handed over.

Sales reports are computed from PostgreSQL in the Asia/Kolkata timezone and compare the selected 7-, 30-, 90-, or 365-day period to the preceding equal-length period. Only live-mode Razorpay captures are counted as collections; new orders record whether Razorpay used test or live keys. Historical orders from before this mode field was added are marked unknown and excluded from revenue totals rather than assumed to be real cash. The analyst brief is a transparent, deterministic summary of store records, not an external generative-AI service. It must not be interpreted as advertising attribution, a demand forecast, or profit reporting; the store does not yet record web traffic, ad spend, supplier costs, or refunds.

The optional **Gemini BI developer** panel lets an owner ask questions about the selected report and receive an answer, evidence, and suggested next steps. To enable it, add `GEMINI_API_KEY` to the private server `.env` (see `.env.example`) and restart the API. Do not prefix it with `VITE_`: the key stays on the server. The server sends Google Gemini the owner's question and a server-built aggregate snapshot of report KPIs, products, regions, inventory, support-status counts, and feedback metrics. It does not send customer identities, contact details, addresses, individual orders, or support-message content. Questions containing detected email addresses or Indian mobile numbers are rejected, but owners should still avoid entering personal or confidential information. Requests use `store: false`, are rate-limited, and time out after 20 seconds. The AI is advisory, can make mistakes, cannot perform actions in the store, and does not replace the deterministic report or the limitations above. Gemini is optional; dashboard reporting continues to work without a key.

Customers can open order-linked or general support tickets from their account and continue the conversation there. The owner can reply, update ticket status, and review/moderate order feedback. Replies remain in the application; outbound email and live chat are not integrated, so the team must monitor the owner inbox. Feedback is attached to a paid order, limited to one submission per order, and remains private to the customer and store team; approved ratings contribute to owner-only KPIs.

### GST, audit ledger, and employee access

The owner dashboard includes a product GST rate and HSN/SAC field, an India GST profile, order-time tax snapshots, and a finance ledger. Product prices are treated as tax-exclusive and the selected GST amount is added at checkout. Existing products have no assumed rate; configure and verify each applicable rate before accepting orders. GST registration details are required before setting non-zero product rates. Ledger entries for captured payments are recorded automatically; expenses, refunds, and reconciliation adjustments are appended manually. Refund ledger records do not call the payment provider, so issue and verify any refund separately first. The ledger is an append-only operational register, not double-entry accounting or a substitute for reconciliations and tax filings. Demo and Razorpay test amounts are reported separately from live collections.

The printed order document is a **draft pro-forma summary, not a GST tax invoice**. It is intentionally not presented as a compliant invoice: have an Indian tax professional verify rates, tax split/place of supply, invoice numbering, shipping treatment, seller details, and filing requirements before using this for legal invoices or tax submissions. Historical orders are not assigned invented tax records.

The owner can create employee accounts for manager, inventory, customer support, and finance roles, assign permissions, deactivate accounts, and reset passwords. Employee passwords are salted and irreversibly hashed; neither the owner nor the application can view an existing password. Resetting a password or changing/deactivating an account revokes its active sessions. Employees sign in through `/employee`; keep owner and employee credentials private and assign only the role needed for the work.

### Optional Zoho CRM synchronization

Zoho CRM is optional. To configure it, create server-side Zoho OAuth credentials with the minimum Contacts permissions needed to create/update records, then set `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REFRESH_TOKEN` in the private `.env`. Set `ZOHO_ACCOUNTS_DOMAIN` and `ZOHO_API_DOMAIN` to the matching Zoho data center (India defaults are shown in `.env.example`) and restart the API. Never put these values in `VITE_*` variables or source control. The owner dashboard's Zoho panel shows queue health, retries, and failures; it can manually queue one customer's record from an order or all existing customers. New registrations and confirmed live Razorpay payments are queued automatically when Zoho is configured. Failed jobs require manual re-queue after the issue is corrected.

The current customer profile stores email only, so the integration sends the account email and aggregate live paid-order count/totals/latest order summary. It does **not** send shipping-recipient names or phone numbers, addresses, payment details, passwords, test/demo orders, or support messages. Enabling CRM transfers customer email and purchase summaries to Zoho; update your privacy notice, confirm your lawful basis and retention settings, and configure Zoho data access before activation.

### Razorpay setup for real payments

The admin dashboard shows which Razorpay credentials are configured, but never accepts or displays secret values. Create and verify your merchant account, add your settlement bank account, and activate supported methods in Razorpay. At checkout, customers can choose UPI, cards, net banking, or supported wallets, or let the secure Razorpay Checkout present all enabled methods. Actual options depend on merchant activation, region, and payment eligibility; payment credentials are entered in Razorpay, never stored by this app. Start with test keys from the Razorpay Dashboard and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the private server `.env` (or the deployment platform's secret manager). Configure the webhook endpoint `/api/payments/razorpay/webhook` for `payment.captured` and `payment.failed`, then store the signing secret as `RAZORPAY_WEBHOOK_SECRET`. Restart the server after changing environment values.

The server creates INR orders using paise, verifies Razorpay's payment signature, confirms the payment amount/currency/order with Razorpay, and captures authorized payments before marking an order `razorpay_paid`. Use the provider's test checkout before changing to live keys. Live keys can collect real money and should only be enabled after merchant approval, HTTPS deployment, webhook configuration, and end-to-end verification. Keep all three credentials private and out of `VITE_*` variables, browser code, source control, and chat.

## Production

```bash
npm run build
npm start
```

Set `NODE_ENV=production`, use HTTPS, and provide production-only `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` values through the deployment environment. The server serves the built frontend and API from the same origin. Never expose the database URL or owner password to Vite or browser code.

In local development, a separate test-only UPI simulation is available; successful simulation records `demo_paid` / `demo_upi`, while failed simulation places no order. The simulation never contacts a bank or UPI app and never moves money. Real Razorpay checkouts are available only when server-side credentials are configured. The app does not yet integrate cash on delivery, email notifications, carrier tracking, email verification, password reset/change, customer profile management, data import/export, or file uploads. Configure India-specific shipping, tax/GST, refund, privacy, and consumer-protection policies with the relevant business providers before production.
