# Executable W4 and W5 coverage

This is a read-only source and test inventory. No tests ran for this document.
Existing test names describe coverage present in source, not a new pass. W1 and
W2 implementation and money conversion are outside this investigation.

The owner accepted Asia/Bangkok daily reporting. Remaining business rules in the
completion plan already have owner decisions. External provider evidence remains
outside these locally executable checks.

## Implementation order

1. Add Bangkok date boundaries and low-performance equality regressions before
   changing analytics and dashboard date helpers. Reuse one day contract in both.
2. Add actual PostgreSQL tests for cashback thresholds, review summaries, search
   filters/badges, recommendations, and discovery flash quotas. Keep independent
   literal fixtures and run APIs against those same rows.
3. Add pure fraud threshold tests and actual repository/service case persistence.
   Add AI rounding cases with deterministic supplied vector matches.
4. Extend browser numeric checks against the same fixtures for dashboard/daily
   dates, reviews/cards, flash availability, buyer coins, and admin fraud scores.
5. Measure analytics candidate and metric growth, sorting, pagination, and
   concurrency in a guarded local load harness. Report measured capacity before
   deciding whether ranking needs another query design.

## Bangkok reporting and analytics thresholds

`ProductAnalyticsService.normalizeDateRange`, startOfDay, and endOfDay at
`server/modules/product-analytics/product-analytics.service.ts:275` use UTC days.
dateKeyFromDate at line 561 also uses UTC. `SellerDashboardService.toSalesSummary`
at `server/modules/seller/seller-dashboard.service.ts:270` uses host-local days
and month starts. Changing the process timezone alone would leave these two
definitions inconsistent.

Existing `product-analytics.service.test.ts:278` tests midday timestamps.
`seller-dashboard.service.test.ts:286` tests ordinary sales totals. Neither has a
17:00 UTC Bangkok date boundary. The PostgreSQL numeric suite has revenue ranking
and sold-count cases, but no calendar boundary. The browser suite
`e2e/numeric-analytics.spec.ts:14` already compares conversion 0.1 to 10% and
revenue ranking pages for one Shop. Extend it rather than treating those checks
as missing.

Add these independent date and threshold cases.

| Input | Expected assertion |
|---|---|
| Custom day `2026-10-04` | Query interval is `2026-10-03T17:00:00.000Z` through `2026-10-04T16:59:59.999Z`. Daily label is `2026-10-04`. |
| Paid merchandise 100 at October 3 16:59:59.999Z, 200 at 17:00Z, 300 at October 4 16:59:59.999Z, 400 at 17:00Z | October 4 daily revenue is 500 with two distinct Orders. Adjacent days receive 100 and 400. Multiple lines of either included Order count one Order. |
| Same view and add-to-cart timestamps as those four Orders | Day October 4 has two view events and two add-to-cart events. Quantity attached to one add-to-cart log does not multiply event count. |
| October month boundary | September 30 16:59:59.999Z is outside October; 17:00Z belongs to October. Seller month total and analytics date grouping agree. |
| Same fixtures with UTC and a second host TZ | API buckets and dashboard totals stay identical because reporting uses Asia/Bangkok explicitly. |
| Views 9/10 and zero Orders | Views 9 is outside lowPerformingProducts; views 10 is included. |
| Views 100, Orders 1 | Conversion is exactly 0.01 and is excluded from the `< 0.01` low-performing rule. |
| Views 101, Orders 1 | Conversion is below 0.01 and is included. |
| Zero views and zero or one Order | Conversion is zero, with no NaN or Infinity. |

The low-performing rule is at product-analytics.service.ts:495. Add equality
cases to its service tests and a real fixture in
`product-analytics-numeric.integration.test.ts`. Browser comparisons should use
the displayed calendar date and the daily API's literal values, not only chart
presence.

Custom dates also need malformed-date, reversed-range, leap-day, and bounded
range cases. Current parseDate accepts JavaScript date normalization, so
`2026-02-30` can become a different valid date. dateKeys iterates every date in an
unbounded custom range. The service validates page as an integer but does not
bound `(page - 1) * limit`. Add a safe offset check and explicitly choose a
supported custom-range limit before claiming bounded memory.

## Cashback

`server/modules/payment/payment.repository.test.ts:32` already has literal
9,999/10,000/10,001 net-merchandise expectations of 0/1/1 cashback coins. The
test at line 48 already checks debt 3 with cashback 5, leaving available 2,
then a later cashback 1, leaving available 3. These tests use mocked Prisma
objects. `buyer-coin.transitions.test.ts` covers cumulative refund rounding and
cashback debt. `BuyerCoinsPage.test.tsx:16` checks debt explanation text.

Add actual checkout/payment PostgreSQL cases with net merchandise
9,999/10,000/10,001 and shipping 5,000. Assert one trusted payment settlement,
ledger 0/1/1, wallet balance 0/1/1, and replay unchanged. Add the existing debt
fixture through two real paid Orders and compare wallet API plus BuyerCoinsPage.
This closes a missing layer of evidence without repeating the existing unit
threshold matrix. The cashback basis remains the implemented merchandise rule;
do not use shipping to cross the 10,000 threshold.

## Reviews and cards

Product review distribution has unit coverage in `review.repository.test.ts:68`
and `review.service.test.ts:340`. Shop summary coverage is in
`shop-review.service.test.ts:160`. Existing literals are product ratings 5,5,3
with average 4.33 and distribution `{1:0,2:0,3:1,4:0,5:2}`, and Shop ratings 5,5,4
with average 4.67. No corresponding PostgreSQL/browser numerical comparison was
found in this inventory.

Build a delivered history fixture with those published ratings plus PENDING,
REJECTED, and HIDDEN high ratings. Assert actual database aggregation and both
summary APIs exclude unpublished rows. Empty publication gives count zero,
average zero, and all five distribution counts zero. Query a feed page smaller
than the total to prove its page count does not become the global rating count.

`ProductDetailPage.tsx:1231` and `ProductCard.tsx:195` display one decimal.
The fixture's 4.33 should display 4.3. `SellerManagePages.tsx:388` displays Shop
insights with two decimals, so 4.67 should display 4.67. Compare these specific
display contracts rather than requiring identical formatting everywhere. Product
buyer-state tests already check review UI behavior, but use mocked responses.

## Search and recommendations

Search badges at `search/search.service.ts:402` use creation age at most seven
days and sold count at least 100. The existing contract-filter test at
`search.service.test.ts:287` exercises filters, but not 99/100 or exact day seven.
With a fixed clock, sold 99 has no best_seller and sold 100 does. A creation time
exactly seven days old has new; one millisecond older does not. Check published
review ratings and active variants in the same actual repository fixture.

`search.service.test.ts:214` and line 222 already cover rating/price filters with
mocks. The actual sold-count parity integration exists in
`product-analytics-numeric.integration.test.ts:76`. Extend a dedicated actual
search fixture with ratings below/equal/above 4 and prices just outside/equal to
the requested interval. On-hand 3 with reserved 3 is unavailable, while on-hand
3 with reserved 2 is available. Check returned items, totals, facets, page two,
and browser badges. The repository's inStock SQL prefilter checks only positive
on-hand at `search.repository.ts:374`; the service applies its derived filters
after reading rows. Test facets as well as cards because these stages differ.

Similar-price padding at `recommendation.repository.ts:183` is the larger of
500 minor units and rounded 25% of the source range or single price. Existing
recommendation service pagination and repository paid-sale tests do not check
actual numeric padding inclusion. Source price 1,000 produces the inclusive
interval 500 to 1,500. Source price 10,000 produces 7,500 to 12,500. Add one unit
below, on each edge, and one unit above. A source range 1,000 to 5,000 produces
padding 1,000 and interval 0 to 6,000. Exclude the source and inactive variants,
Products, Shops, and other categories. Assert stable nonoverlapping pages and
hasNextPage with one extra row, then match recommendation cards to API values.

## Flash discovery and quota

`discovery/discovery.service.ts:137` returns the minimum of remaining campaign
capacity and physical available inventory, clamped to zero.
`discovery.service.test.ts:106` has one mocked example. MarketplaceHome tests
check zero-stock UI, but not actual reservations around quota boundaries.
`discovery.repository.ts:90` includes only ACTIVE reservations with expiry
strictly after now. The campaign is active with startsAt <= now and endsAt > now.

Use stockLimit 10, sold 2, active nonexpired holds 3, physical on-hand 10 and
reserved 4. Discovery availableStock must be 5. Changing physical reserved to 7
makes it 3. A campaign remainder zero or negative displays zero. A hold expiring
exactly at now contributes zero. ACTIVE holds one millisecond later contribute
their quantity. RELEASED/COMMITTED/EXPIRED holds do not reduce quota. Check the
actual endpoint and homepage button state. Add a two-buyers-last-quota PostgreSQL
case using the controlled barrier pattern in checkout-concurrency.integration.test.ts.
The mapped repository tests cover quota reads with mocks, and numeric-commerce
browser tests cover flash pricing, but no actual last-quota race was found here.
Require exactly one winner. Do not invent a separate count from homepage progress bars.

## Fraud and AI score

`fraud/fraud.service.test.ts:117` covers selected signals and case deduplication.
`fraud.routes.test.ts` covers admin access. No exhaustive pure threshold suite or
actual PostgreSQL case-score/browser comparison was found.

Add a `fraud.rules.test.ts` matrix against the real functions in fraud.rules.ts.
Use below/equal/above default boundaries for IP counts 5, failed payments 3,
refund count 3 together with ratio 0.5, coupon uses 5, device accounts greater
than 1, order amount 100,000, checkout seconds at most 60, and cancellations 3.
Expected signal scores are respectively 20,45,75,75,20,20,15,20. Self-referral
alone is 80. All signals produce capped score 100 and nine reasons. Level
boundaries 39/40/69/70/89/90 produce low/medium/medium/high/high/critical.

Refund context uses refund row count divided by Order count, not refunded cash
ratio. Three refund rows over six Orders give score 75; over seven Orders give
zero when other signals are absent. Pending and failed refunds currently count
in the repository too. Record this actual behavior explicitly and decide any
business change separately.

FraudService rounds elapsed milliseconds to seconds before applying the rapid
rule at `fraud.service.ts:86`. Durations 60,499ms and 60,500ms become 60 and 61.
Test that conversion explicitly rather than claiming a raw 60,000ms cut-off.
Use actual repository/service evaluation for one threshold case and repeat it.
Assert one persisted FraudCase and admin API riskScore/riskLevel. The UI is
`AdminBackofficeTables.tsx:171`. The IP/device pure rules have no corresponding
signals in evaluateOrderRisk's current payload, so pure tests alone cannot claim
runtime IP/device fraud detection.

AI score rounding is `ai-search/ai-search.service.ts:215`. Existing unit input
0.91 is already four-decimal exact. Add supplied vector matches 0.123444 and
0.123456, with literal outputs 0.1234 and 0.1235. The adapter test already covers
live public record rejoin with mocks. A deterministic supplied-vector test proves
rounding and API metadata, not actual external vector retrieval. This inventory
found no product UI rendering the numeric semantic score. Do not fabricate a
UI-score parity claim or add a user-facing score just to make one.

## Bounded analytics load

The repository reads candidates in batches of 500 but accumulates every candidate
at `product-analytics.repository.ts:87`. The 501-row repository test at line 47
uses mocks. ProductAnalyticsService.getProducts at line 198 loads every metric,
builds maps, sorts all candidates, then slices the requested page. getDaily reads
raw view and add-to-cart logs and constructs every requested day. These are the
actual memory dimensions to measure. Search also loads all eligible rows before
filtering and pagination, so measure it separately if the same test dataset is
used rather than labeling analytics findings as search proof.

`scripts/production-load-test.ts` already guards local disposable endpoints and
records p95/error rates plus machine free memory. Its traffic is catalog reads
and pending checkout creation. It does not exercise authenticated analytics or
sample the target API's RSS/heap. Extending its summary alone cannot close W5.

Add a guarded analytics harness with deterministic ranking rows at 501, 5,000,
and 20,000 Products, proportional SKUs, and explicitly recorded view/Order Item
counts. Run page 1, page 2, last page, and just beyond last at limits 1/20/100.
Assign literal top values independent of creation order and include ties resolved
by existing stable ID order. Verify total candidate count and no duplicate or
missing IDs across sampled pages. Use concurrency 1/5/20 on the same Shop and
separate Shops, with cold and warm requests reported separately.

Record dataset shape, seed time, per-endpoint latency percentiles, error count,
API process RSS/heap before/peak/after, SQL query count, and machine/runtime.
Protect duration and fixture-size bounds so the harness cannot silently run
unbounded work. Report the observed capacity and chosen latency/memory acceptance
limits. A laptop run at these sizes cannot establish the production ceiling or
justify claiming all catalog sizes passed. Final fixes and tests require W10's
whole-repository and browser gates.
