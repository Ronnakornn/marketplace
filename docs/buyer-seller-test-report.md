# Buyer/seller test report — 2026-09-07

## Latest verification

- Headed Chromium: **12 passed in 3.1 minutes** (11 scenarios and one authentication setup), with 150 ms action pacing.
- Seller product component suite, rerun alone: **26 passed**. Two tests timed out when the full suite ran concurrently with browser tests and typecheck; their timeouts were not increased.
- Full unit/integration suite, run separately with all infrastructure test variables enabled: **1,046 passed across 152 files** in 48.3 seconds; no skipped tests.
- `bunx tsc --noEmit --incremental false`: passed.
- `git diff --check`: passed (line-ending warnings only).

Browser tests used isolated frontend/API ports 3100/3101 and a migrated, seeded local PostgreSQL 17 database, `marketplace_e2e_extended`. Integration tests used disposable `marketplace_test_*` databases. No production database was used. Unique browser fixtures remain in the disposable database.

Owned temporary PostgreSQL and Redis services were stopped after verification; ports 3100, 3101, 55439, and 56379 were confirmed released. Temporary database files remain on disk. Changes have not been committed.

## Browser coverage

| Flow | Verified behavior |
| --- | --- |
| Purchase and fulfillment | Buyer signs in, adds a product, checks out; signed test payment webhook confirms payment; seller packs and ships; buyer sees matching tracking. |
| Review and return | Buyer submits a review and return for an eligible delivered item. |
| Failed/expired/canceled payment | Three scenarios verify canceled buyer state, released stock and coupon reservation, restored coins, canceled ShopOrders, and no seller fulfillment task. |
| Multiple shops | Each seller sees their own shipment; first shipment leaves the parent partially fulfilled; second makes it shipped; buyer sees each submitted tracking number. |
| Stock changes | Stock disappearing after the quote produces a readable checkout error and leaves no order or reservation. |
| Price changes | Reloading the quote reflects the current server price, and checkout persists that total. |
| Session and ownership | Expired session requires login; another buyer cannot read the order; buyer cannot access admin/seller resources; another seller cannot edit the product. |
| Partial order refund | One of two discounted items is returned and approved; two administrators complete the refund; retry does not duplicate the seller debit; seller balance is displayed correctly. |
| Payout | Seller reserves funds; insufficient-balance retry is rejected; two administrators complete the payout; duplicate completion does not debit again. |

Run with `bun run test:e2e:buyer-seller` using the disposable-database configuration in `TESTING.md`. The script runs all three buyer/commerce/finance spec files in headed Chromium. HTML evidence is in `playwright-report/index.html`.

## Bugs fixed during this expansion

1. **Concurrent cart creation:** simultaneous first requests could create multiple active carts. Creation now locks the user row and rechecks inside the transaction. A real PostgreSQL regression synchronizes six competing requests and verifies one cart with retained items. Existing duplicate carts are not merged by this change.
2. **Multi-shop fulfillment status:** sibling shipments could leave the parent status incorrect, including under concurrent shipping or delivery. Transitions lock the parent order and aggregate sibling statuses into `PARTIALLY_FULFILLED`, `SHIPPED`, or `DELIVERED`. Unit tests and two real PostgreSQL concurrency scenarios cover this.
3. **Unreadable checkout errors:** nested API errors rendered as `[object Object]`. Checkout and quote now construct `ApiClientError` with the server message, status, code, and details. Two regression tests failed before the fix and passed afterward; the browser stock scenario also passes.

The earlier expiry fix remains covered: the expiry transaction cancels every ShopOrder as well as the parent, releases stock once, and remains idempotent. No schema changes were required.

## Real infrastructure coverage

The full suite enables 17 real-infrastructure scenarios: 13 commerce scenarios, one cart concurrency scenario, two shipment concurrency scenarios, and one Redis expiry scenario. Commerce coverage includes trusted totals, overselling protection, rollback, webhook amount checks, duplicate settlement, failed/expired payment recovery, payment/cancellation races, late-payment rejection, ownership, refund atomicity, and payout concurrency.

The Redis test uses the application's actual BullMQ scheduler and worker factories with real Redis and PostgreSQL. It verifies scheduled expiry and repeated-job idempotency without directly invoking the processor. It uses a dedicated local instance on port 56379/database 15, refuses existing application queue keys, and removes only its owned queue. It does not use FLUSHDB.

The available Redis is **5.0.14.1**, tested with explicit `QUEUE_TEST_ALLOW_OLD_REDIS=true`. This is evidence for the local job behavior, not certification of a supported production Redis version. Worker factories run within the test process; the deployed worker CLI/process and deployment configuration were not tested.

## Remaining external checks and limits

**Actual payment-provider sandbox has not run.** No provider/bridge URL or test credentials are configured, and the provider has not been identified. The user has been asked for the provider and config location. Signed test HTTP webhooks exercise the application boundary but do not establish real provider callback delivery or reconciliation. See `docs/04-security/payment-provider-contract.md` for the gateway bridge contract.

Finance browser tests start from delivered/paid database fixtures and use test external references. They do not transfer or refund real money. The partial-return test returns a whole item from a multi-item order, not a subset of units within one item. Price coverage explicitly requotes before checkout; it does not claim every stale-price interaction is covered.

These are scenario results, not a measured coverage percentage. They do not establish production deployment, load capacity, backup recovery, carrier delivery, or whole-system production readiness. Late payment rejection also does not establish reconciliation of money already collected externally. A PostgreSQL client deprecation warning was observed; it did not fail these runs.
