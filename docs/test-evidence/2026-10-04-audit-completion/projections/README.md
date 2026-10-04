# Public numeric projection browser proof

Preparation status at commit `7444269` was **NOT EXECUTED**. Root subsequently ran the integrated browser suites. All three projection cases passed in the Chromium rerun after a real UUID storefront fix and selector corrections. The current cross-browser outcome is recorded in the [completion report](../../../numeric-audit-completion-report.md).

The deliverable is `e2e/numeric-projections.spec.ts`. It adds three independent tests with real same-origin API reads, PostgreSQL fixture rows and public UI assertions. No API route interception supplies expected results. `commerceFixture` rejects databases outside local `marketplace_e2e_*`. Historical paid orders and published ratings are fixture preconditions, not proof of checkout, webhook verification or moderation workflows. Shop rating cache is initialized explicitly as a historical precondition.

| Case | Independent DB/API expectations | UI expectations |
| --- | --- | --- |
| Published product and shop ratings | Product published5,5,3 gives count3, sum13, average4.33 and buckets5=2,3=1. Shop published5,5,4 gives count3, sum14, average4.67 and buckets5=2,4=1. Pending, rejected and hidden5 values stay excluded. Product pages have2+1 rows while summary remains3. Shop feed page has2 while total remains3. Shop stored cache is4.67/count3. | Product summary4.3, 3reviews, three articles, 5-star bar67%, 3-star bar33%. Shop identity4.7/count3 and three published articles. |
| Search ratings, badges and stock facets | Paid delivered sales99 and100 yield sold99 and100. Older product has in_stock only. New product has new,best_seller,in_stock. Two variants have onHand3/reserved2. Third has3/3 and stays excluded. Category and brand facet counts2. Price facet1000..2000 minor units. Rating>=4 and price1000..2000 return only the2000 variant. | Cards show99/100sold, ratings3.0/4.0, ฿20.00, applicable badges, count2, category/brand count2 and price placeholders1000/2000. Filtered UI has one card/count1. ProductCard intentionally displays only the first two badges. |
| Related and similar prices | Source1000. Candidates499,500,1500,1501. Similar API includes500/1500 only. Catalog related API includes all four. DB variant prices remain499/500/1500/1501 bigint. | Related rail has four cards priced฿4.99, ฿5.00, ฿15.00 and฿15.01. |

The related rail in `ProductDetailPage` calls Catalog `/api/products/:productId/related`, then displays its first four rows. It does not call Recommendation `/api/recommendations/similar/:productId`. The test proves price parity for the actual rail and separately proves the similar API bounds. It does not claim those bounds select the UI rail.

The search test uses a unique category, brand and query token to isolate shared database contents. Related rows have deterministic distinct creation instants and fill all four category slots before Catalog falls back to other products. Each test gets separate users, shop and products. Responsive filter assertions open the mobile filter sheet when visible.

On execution, each checkpoint attaches API/DB values as JSON and a full-page PNG through `testInfo.outputPath`. Root must retain the Playwright report and trace for failures and mark actual per-browser outcomes. The root project test regex must include `numeric-projections.spec.ts`.

## Preparation checks

An isolated `bunx tsc --noEmit --incremental false` check on the pre-integration worktree failed with44 inherited frontend money representation errors and no diagnostic for `e2e/numeric-projections.spec.ts`. `typecheck.log` records that limited check. It does not establish an integrated typecheck or browser pass. Root must repeat validation against its merged money/UI/tax state.

Source review checked `ReviewService`, `ShopReviewService`, `SearchService`, `RecommendationService`, Catalog related queries, ProductDetailPage, ProductCard, ProductListingPage and StorefrontIdentity/StorefrontDetails. No application or server file changes are included.

## Remaining browser scope

External AI vector acquisition and score UI are excluded. The recommendation API tests use local stored prices; they do not contact an external AI provider. Fraud has an admin interface in `AdminBackofficeTables`. Admin score75/100 and review/resolution browser evidence is now included in the completion report. Backend threshold execution evidence remains in the existing threshold artifacts.

## Execution choices

Test Behavior, Not Implementation led to literal expected averages, stock facets and currency labels without importing production calculators. Model the Domain led to a typed ProductRow and a local historical sale fixture shared by the two history-dependent cases. Prove It Works keeps browser outcomes explicitly untested until root executes them.

The implementation checkpoint had source grounding before edits. There is one owned test file and one proof directory, so independent workstreams are not applicable. Unique fixture identities separate shared database state. One worker owns the test file; root supplies independent integrated execution. Parallel architect exploration and nested delegation were skipped under the root's single-slice ownership and available agent limit. No PR, full build, browser process or shared configuration change is part of this preparation slice.
