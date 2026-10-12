# Full Admin

Administrative APIs require a verified ACTIVE ADMIN user and an active team
membership. Owners receive the permission registry; other members receive only
their assigned grants. Unknown administrative routes fail closed. The sidebar
uses the same registry, while APIs enforce access independently of the UI.

Existing administrators become owners in migration `20261013000100_full_admin`.
New installations use `ADMIN_EMAILS` and `bun run db:seed-admin` after creating the
accounts. Demo seeding creates its own owner membership. The final eligible owner
cannot be demoted, disabled or deleted through either user administration API.

| Area | Available workflows |
| --- | --- |
| Overview | Daily/monthly purchased sales, original commission/funding, recorded expenses, top products/categories, popular searches and urgent queues |
| Users and teams | Buyer addresses/orders/coin history, statuses, team grants and protected owner changes |
| Shops | KYC/risk/quality history, owner-visible admin notices, original commission and dispatch/delivery policies |
| Catalog | Configurable preapproval, approve/reject reasons, category/brand/attribute management, CSV/XLSX preview and atomic bulk changes |
| Orders | Order/shop/payment/delayed shipment filters and immutable printable invoice/receipt downloads |
| Payments | Channel toggles, existing webhook logs, exact statement preview/import and reconciliation |
| Payouts | Manual and scheduled cycles, balance/debt checks, private evidence and two-person approval/completion |
| Shipping | Provider administration and region/postal/weight/dimension rules, quotes and original shipment snapshots |
| Marketing | Existing coupons/flash sales, product/category targets, shipping subsidy and timed banners/popups |
| Moderation | Product/shop review reports, Q&A and content decisions |
| Support | Participant conversations, private notes/evidence, appeal decisions and compensation linked to an exact refund plan |
| Reports | Drilldowns, exact CSV/XLSX exports, private downloads and recurring schedules |
| Settings/content | VAT settings, THB/default locale, typed settings, published CMS revisions, templates, maintenance and scoped toggles |
| Security | Audit history, granular team permissions and expiring account/IP/signed-device allow/deny rules |

## Money and original facts

Amounts remain bigint minor units and canonical strings at the HTTP boundary.
Checkout determines prices, eligible coupon items and shipping on the server.
Orders retain the original commission, carrier, rate version and SLA. Editing
current policy does not recalculate existing purchases. Seller content edits
advance the reviewed product revision; when preapproval is enabled, active
listing edits return to PENDING_REVIEW. Concurrent approval rejects stale data.

Reports label contribution and operating contribution explicitly. Operating
contribution subtracts MATCHED recorded operating expenses; it excludes
unrecorded costs and cannot allocate expenses to product/shop/category/region
filters. This is not a complete accounting profit statement. Purchase invoices
and receipts are printable HTML; they do not claim legal tax-invoice issuance.

Uploaded support/finance evidence is private. Support compensation does not move
money: it links the exact appealed item quantities to a frozen PROCESSING or
SUCCESS refund. PROCESSING stays RESOLVED_BUYER until refund settlement succeeds.
Only a FAILED linked refund can be replaced, with an audit of the former link.
Refund and payout completion preserve two-person and external-reference rules.
Bank statement rows and uploaded slips never mark a Payment SUCCEEDED.

## Background and external services

Run the existing `bun run jobs:worker` with configured Redis. The worker registers
`process_admin_report_schedules` and `prepare_admin_payouts` every minute. Report
claims recover after 15 minutes and retry failures after five minutes. Private
exports expire after seven days. Revoked schedule requesters are paused. Payout
cycles use the actual stored policy updater and recheck their current permission.
Preparation creates requests; it does not transfer funds.

Commerce notification creation consumes delivery toggles and active localized
templates. Authentication delivery retains its existing configuration. SMS/LINE,
live payment transfers, carrier labels/pickups and provider delivery require real
configured adapters and credentials. Management screens do not simulate their
success. Commerce currently uses THB; selecting a default language does not
introduce foreign-exchange conversion.

## Verification

The production quality workflow requires separate disposable PostgreSQL databases
for commerce, queue, tax, rollout, audit, reporting, directory, admin operations
and admin boundary tests. It rejects missing opt-ins and skipped/omitted suites.
See `.github/workflows/production-gates.yml`. New admin boundary tests exercise
owner races, revoked rights, private evidence, compensation settlement, stale
product approvals, frozen shop/shipping facts and targeted coupon allocations.
