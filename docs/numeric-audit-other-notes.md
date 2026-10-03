# Numeric audit of discovery and seller metrics

This report records source inspection on 2026-10-04. The baseline is `ed2093b`. No database, browser, or test process ran during this inspection. Existing tests below describe available coverage, not a passing result.

The implementation and deterministic verification followed that initial source inspection. The baseline findings below preserve the original evidence.

The Prove It Works principle changed the result labels. Source findings remain separate from runtime verification. The technical-writing and unslop skills shaped this report as a reference document with concrete examples.

## Source findings

### Analytics percentages display one hundredth of the expected value

The API returns a fraction. `server/modules/product-analytics/product-analytics.service.ts:483` returns `orders / views`. Its service test asserts `0.1` for one order and ten views at `product-analytics.service.test.ts:135`.

The UI appends a percent sign to that fraction at `app/features/seller/components/SellerProductAnalyticsPage.tsx:228`. The same formatter renders the KPI at line 103, the product table at line 47, and the low-performing summary at line 160.

The independent expected result for 20 views and two distinct orders is an API fraction of `0.1` and displayed text `10%`. The inspected UI produces `0.1%`. For no views, both API and display remain zero. For three orders and 1,000 views, the display must be `0.3%`.

The UI fixture conceals the mismatch. `SellerProductAnalyticsPage.test.tsx:21` uses `conversionRate: 3` with 36 orders and 1,200 views. The corresponding API value is `0.03`. The daily fixture also uses percentages instead of fractions at lines 60 and 61.

Status is source-confirmed defect. Runtime reproduction and regression checks remain for the implementation owner.

### Analytics sort applies after pagination

`ProductAnalyticsService.getProducts` retrieves a page and then sorts its metrics at `server/modules/product-analytics/product-analytics.service.ts:198`. `PrismaProductAnalyticsRepository.findProducts` already orders by creation time and applies `skip` and `take` at `product-analytics.repository.ts:128`.

The SKU endpoint has the same sequence. `getSkus` starts at service line 219. `findVariants` orders by update time and applies `skip` and `take` at repository line 194.

The independent dataset has three products. A is newest with revenue 100 minor units. B is second newest with revenue 200. C is oldest with revenue 900. For `sort=revenue&page=1&limit=2`, the expected IDs are C and B. The inspected path fetches A and B first, so it can return only B and A. Page two returns C despite its highest revenue. The same example applies to SKU sorting.

The existing test at `product-analytics.service.test.ts:193` returns two mocked products with a limit of two. It checks sorting within one page and cannot detect sorting across pages.

Status is source-confirmed defect. A regression must span more records than the page limit and check that pages collectively follow the requested metric order.

### Home recommendation sold counts include unpaid items

`server/modules/recommendation/recommendation.repository.ts:89` selects every order item's quantity. Its selection has no payment-status filter. `recommendation.service.ts` then adds those quantities in `toProductCard`.

`server/modules/search/search.repository.ts:181` selects quantities only when the order has `paymentStatus: 'SUCCEEDED'`. Catalog public metrics follow that same filter in `catalog.repository.ts:825`.

The independent dataset has one paid order with quantity two and one pending or canceled unpaid order with quantity five. Search and catalog return sold count two. The inspected recommendation path returns seven. The buyer therefore sees different counts for the same product on home cards and search or product pages.

Status is source-confirmed inconsistency. A repository regression must inspect the actual selection or use a disposable database with both order states. Service-only mocked rows cannot prove paid-order filtering.

## Formula inventory and independent examples

| Flow | Source rule | Independent expected example | Available test scope |
| --- | --- | --- | --- |
| Product analytics views | Count view-log rows in the requested UTC day range. | Three log rows give three views, even for one viewer. | Summary, daily, serialized date, and empty tests. |
| Product analytics add-to-cart | Count log events separately from summed quantity. | Two events carrying quantity three and four give event count two and quantity seven. | Summary and SKU fixture tests. No explicit event-versus-quantity edge case found. |
| Product analytics orders | Deduplicate order IDs within the requested product, SKU, or summary. | Two item rows from one order give one order and the sum of their quantities. | Summary fixture has one order. No explicit duplicate-ID fixture found. |
| Product analytics revenue | Sum trusted paid order-item `lineTotal` values. This is gross merchandise revenue before order discounts or shipping. | Line totals 1,201 and 799 give revenue 2,000 and display THB 20.00. | Summary and daily literal expectations. No discount-to-dashboard reconciliation test found. |
| Product analytics conversion | Unique paid orders divided by views. Zero views yields zero. | Two orders and 20 views give API fraction 0.1 and UI 10%. | Service expects a fraction. UI fixtures use percentages. |
| Low-performing products | Require at least ten views and conversion below 0.01. Sort by views descending, then conversion ascending, then title. Keep five. | Ten views and no orders qualifies. One order and 100 views is exactly 1% and does not qualify. | No explicit threshold boundary test found. |
| Analytics pagination | Page must be a positive integer. Limit is 1 through 100. Total pages is the ceiling of total divided by limit. | Total 21 and limit ten give three pages. An empty set gives zero pages. | One-page metric sorting test. Missing global metric sorting across pages. |
| Seller sales dashboard | Sum seller-scoped paid order-item `lineTotal` values. Today and month use the execution host's local midnight. | Items from this seller worth 100 and 200 yield 300, even when another seller's item in the order is worth 900. | Shop isolation, zero data, sales, and recent-order tests. No UTC-to-Bangkok midnight test found. |
| Seller recent orders | Sum only scoped seller item line totals. | Multi-shop order with this seller's 1,500 and 500 produces recent total 2,000. | Seller-item isolation test. |
| Seller low-stock count | Available equals on-hand minus reserved. A row is low stock when available is at most its reorder level. | On-hand eight, reserved three, reorder five gives available five and qualifies. Reserved two gives available six and does not qualify. | Low-stock service test covers the comparison. |
| Seller review insights | Average only published shop ratings, round to two decimals, return zero when none exist. Pending count remains separate. | Ratings one, four, and five give 3.33. A pending one-star review does not change it. | Review aggregate and zero-data fixtures. |
| Product and shop review summaries | Aggregate published counts for integer ratings one through five. Weighted sum divided by total count, rounded to two decimals. | Two five-star and one one-star reviews give distribution 1 at star one, 2 at star five, count three, and average 3.67. | Literal summary service tests and repository published-only tests. |
| Search price range | Minimum and maximum of active variant prices. Equal prices omit the max range. Filters use minor units. | Variant prices 100 and 250 give min 100 and max 250. Two prices of 100 give min 100 and max null. | Price-range service test. |
| Search stock | Clamp on-hand minus reserved at zero. In-stock filter requires at least one positive available variant. | On-hand three and reserved five yields stock zero. | Search service stock test. |
| Search rating filter | Accept ratings from one through five, including fractional thresholds. Compare the product's rounded published-review average. | Rating 4.5 rejects an average of 4.49 and includes 4.50. | Rating filter service test. Missing exact rounding-boundary check. |
| Search pagination | Sort first, then apply page or cursor offset. Total pages is ceiling of total divided by page limit. Invalid cursor restarts at offset zero. | Five records and limit two give three pages. Cursor at record two begins with record three. | Pagination and cursor service tests. |
| Search badges | Best seller starts at 100 paid units. New badge includes products created within seven days. In-stock requires positive available quantity. | 99 paid units is not best seller. 100 is. | Combined contract-filter test. No exact 99 versus 100 boundary found. |
| Recommendation pagination | Request limit plus one, return at most limit, use extra row as next-page indicator. | Three fetched rows for limit two return two rows and `hasNextPage: true`. | Pagination service test. |
| Recommendation similar price | Padding is the larger of 500 minor units and rounded 25% of the price range, or 25% of one price when the range is zero. | A single 10,000 price gives a 7,500 through 12,500 inclusive candidate range. | Similar-products test checks public filtering, not exact numeric bounds. |
| Flash-sale discovery availability | Campaign availability is max of zero and stock limit minus sold minus active reservations. Buyer availability is the smaller of campaign and physical available stock. | Limit ten, sold four, held three, physical available five gives available three. Physical available two gives available two. | Discovery merchandising fixture. No explicit reservation or clamping case found. |
| AI search scores | Round semantic score to four decimal places. Product rating uses two decimals. | Score 0.123456 displays 0.1235. Ratings one, four, five give 3.33. | AI search service and adapter tests exist. No browser parity assertion found. |
| Fraud refund ratio | User refund count divided by order count. Zero orders yields zero. | Three refunds across six orders gives 0.5. | High-refund service test. |
| Fraud risk score | Add configured signal weights, cap at 100. Defaults are medium at 40, high at 70, critical at 90. | Failed payments gives 45 and medium. Add same-IP weight 20 for 65 and medium. Add canceled-order weight 20 for 85 and high. Add abnormal amount weight 20 for capped 100 and critical. | Service tests cover selected signals and duplicate case identity. No complete threshold table found. |
| Fraud checkout duration | Rounded seconds between order and checkout creation, clamped at zero. Defaults mark at most 60 seconds as rapid. | 60 seconds triggers. 61 does not. | No explicit 60 versus 61 boundary found. |

## Validation gaps

Many services accept page numbers with `Number.isInteger` but no safe-integer or maximum-offset check. Search, recommendation, reviews, shop reviews, and analytics therefore accept huge integer page values before constructing an offset. A database-backed API test must determine whether those requests produce a controlled client error or a database error. This is an unverified gap, not a claimed observed failure.

`SearchService.normalizeRating` checks numeric type and the one-through-five range without a finite-number check. A direct call with `NaN` passes that normalization and subsequently filters every product out. HTTP schema parsing may prevent the input. This is a service boundary gap without a demonstrated browser input path.

Analytics custom date ranges have no upper bound. Daily-series generation iterates every UTC day in the range. Very large valid ranges can allocate very large responses. No runtime timing test ran.

Seller dashboards use host-local day boundaries. Product analytics uses UTC day boundaries. The different time basis is observable in source. The product contract does not establish that these metrics must match at midnight, so this report records the mismatch for reconciliation rather than declaring the product behavior wrong.

## Existing end-to-end numeric assertions

| Spec | Available numeric evidence | Remaining coverage |
| --- | --- | --- |
| `commerce-edge-flows.spec.ts` | Failed, expired, and canceled payments restore stock and coin balances. Price change asserts quote 24,000, UI THB 240.00, API total 24,000, and order UI THB 240.00. Stock loss asserts rollback with zero orders and checkouts. | No independent discounted grand-total assertion, DB price snapshot assertion, duplicate provider event, or multi-buyer stock race. |
| `buyer-checkout-payment.spec.ts` | Stock remains on hand before signed paid event, moves only after event, reserved becomes zero, and two shops create two shipments. | Webhook amount is copied from checkout response, so the test does not independently prove the monetary total. No exact price total or duplicate event assertion. |
| `checkout-resilience.spec.ts` | Double click sends one submission. Lost response retry preserves one order, one payment, one checkout, and reserved quantity two. | This proves browser submission prevention and retry handling. It does not create concurrent independent API transactions for competing buyers. |
| `finance-lifecycle.spec.ts` | A discounted partial return refunds 3,200, records one seller debit of negative 3,200, and displays 68.00. A 6,000 payout from opening 10,000 leaves 4,000. Duplicate completion does not duplicate the debit. | Historical finance fixture bypasses checkout and webhook. No minor-unit remainder allocation or competing simultaneous payout in this spec. |
| `catalog-checkout-guards.spec.ts` | Seller price change changes cached price from 10,000 to 12,500. Suspension rollback leaves zero orders and checkouts. | No full cart, checkout, payment, DB reconciliation for this price-edit case. |
| `storefront.spec.ts` | Loads 13 unique catalog links after paging. Reviews use a mocked four-review response. | No literal product-price sort order, rating DB reconciliation, or sold-count parity. |
| `seller-workflows.spec.ts` | Checks inventory minimum attribute, read-only reserved field, and browser payout validity for zero and one. | Input attributes do not prove persistence or server numeric rejection. No seller analytics percent assertion. |

No end-to-end seller analytics, fraud numeric score, AI score, or recommendation paid-only sold-count assertion was found in the inspected specs.

## Disposable database safety

`e2e/helpers/commerce-fixtures.ts` refuses a host other than localhost or 127.0.0.1 and a database name without the `marketplace_e2e_` prefix. `e2e/helpers/finance-fixtures.ts` makes an isolated raw Prisma client after the same prefix and local-host check.

The package `test:e2e` scripts run `scripts/assert-e2e-database.ts` before migrations and seeding. That script checks the PostgreSQL protocol and a test or e2e token in the database name. It permits a remote host and is less restrictive than the commerce and finance helpers.

Direct `playwright test` bypasses the package safety script. The Playwright configuration does not call the guard. The storefront helper, `buyer-checkout-payment.spec.ts`, and `admin-workflows.spec.ts` mutate seeded resources without their own database-name guard. The paid-checkout setup resets inventory and releases active reservations. Those specs therefore require explicit selection of a disposable test database before execution.

The Playwright configuration can reuse an existing frontend and API when isolated ports are absent. A runner's database selection alone does not prove that a reused API process connects to the same disposable database. A numeric integration run must verify both process environments or start isolated ports without reuse.

No current connection string, credentials, or private values are recorded here. This worker did not mutate or clean up a database.

## Fixes and deterministic verification

The buyer now sees only paid units in recommendation sold counts. Sellers see conversion fractions rendered with percent formatting, and product or SKU metric rankings apply across pages.

The ID/title and ID/SKU candidate shapes derive from Prisma `Pick` types. Repository queries fetch these lightweight rows in keyset batches of 500. The service builds metric maps, sorts all matching candidates with stable ID ties, selects the page IDs, and fetches detailed rows only for those IDs. The obsolete creation-order pagination methods were removed after their callers moved.

The alternative was database aggregate ranking for every sortable metric. That needs a larger repository redesign. The chosen fix retains the existing service metric ownership and avoids loading image and shop detail for every catalog row.

The candidate list and existing metric rows still use memory proportional to catalog and log size. Batched queries bound each database response, but they do not bound total service memory. Database aggregate pagination remains a scalability limitation. This run did not measure a maximum supported catalog size.

The Model the Domain principle led to shared metric maps for ranking and response rows. Type System Discipline led to Prisma-derived candidate types. Test Behavior, Not Implementation led to literal expected pages and displayed percentages.

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline regressions | Four failures across the percentage formatter, product ranking, SKU ranking, and paid-only sold count. Thirteen pre-existing checks passed. | `docs/test-evidence/2026-10-04-numeric/other-red.log` |
| Focused deterministic suite after fixes | Six test files passed. Thirty-three checks passed. Two database integration checks skipped because no disposable database URL was supplied. | `docs/test-evidence/2026-10-04-numeric/other-green.log` |
| TypeScript check after final implementation | `bunx tsc --noEmit` completed with exit code zero. | `docs/test-evidence/2026-10-04-numeric/other-typecheck.log` |
| Changed-file whitespace check | `git diff --check` completed without errors. | Checked directly after implementation. |
| New PostgreSQL integration checks | Prepared, not executed by this worker. The parent runner owns serialized database execution. | `server/modules/product-analytics/product-analytics-numeric.integration.test.ts` |

The new database checks require `COMMERCE_TEST_DATABASE_URL` pointing to a local disposable `marketplace_test_*` database. They compare product and SKU revenue pages against 900, 200, and 100 minor units. They also compare recommendation and search sold counts against nine when pending quantity five and canceled quantity four exist for the same SKU.

The deterministic recommendation repository check uses a query-aware fake database. It proves the paid-only relation query and the resulting service sold count. It does not replace the real PostgreSQL check. The UI regression renders the actual component against API-shaped fractions of 0.1, 0.125, and 0.003 and expects `10%`, `12.5%`, and `0.3%`.
