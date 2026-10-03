# Numeric flow audit

Baseline: `ed2093b`. Run date: 2026-10-04, Asia/Bangkok.

- [x] Read the Principles section of poteto-mode.
- [x] Phase A: Frame. Inventory numeric flows across commerce, finance and derived statistics. Completion requires evidenced pass/fail/untested results for every discovered flow.
- [x] Phase B: Design the workflow. Use existing Vitest and Playwright harnesses, a new disposable local PostgreSQL instance, independent literal expectations and three isolated source-audit outputs.
- [x] Phase C: Run the loop.
- [x] Collect formulas, business rules, data tables, numeric boundaries and existing test coverage before changes.
- [x] Capture the non-E2E baseline and activate PostgreSQL integration gates.
- [x] Reproduce confirmed defects with regression tests, then apply minimal fixes in separate ownership scopes.
- [x] Compare buyer/seller UI amounts with API responses and persisted PostgreSQL values.
- [x] Exercise rollback, replayed payment events and concurrent checkout/reservation transitions.
- [x] Phase D: Keep the audit trail. Record decisions and evidence in numeric-audit-decisions.tsv.
- [x] Phase E: Verify and hand back. Run final tests/typecheck and report verified, failed and untested cases without promoting mocks to database evidence.

Affected domains: catalog, cart, checkout, inventory, promotion, order, shipping, payment, refund, wallet, payout, affiliate, reviews, analytics, discovery/search.

Affected tables are existing schema entities, including ProductVariant, Inventory, InventoryReservation, CartItem, Checkout, Order, OrderItem, ShopOrder, Payment, PaymentEvent, CouponRedemption, BuyerCoinWallet, BuyerCoinTransaction, ShopWallet, WalletLedgerEntry, SellerPayout, ReturnRequest and Refund. No schema change planned.

Risks: money is stored as bigint minor units but often converted to JavaScript number; displayed prices can diverge from snapshots; concurrent transitions can apply arithmetic twice; independent totals may expose unsettled discount/commission policies. Tests must use disposable local databases and exact expected values, preserve the baseline changes, and label external-provider or environment gaps explicitly.

Throughput checkpoint: three source slices run in parallel. Shared database/browser runs execute sequentially to avoid fixture or port contention. Root reviews every output and fixes only reproduced defects. No deployment, merge or push is part of this request.
