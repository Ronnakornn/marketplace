# Independent final source review

Date: 2026-10-04. Same-family independent subagent review. Reviewed the working tree against HEAD 02d5c07ab0e27504a27d966fa7f1e0492b66455a; source was changing concurrently. Read-only application review; no duplicate tests run.

## Resolved coin-history finding

**P2, resolved — explicit snapshot coin refunds previously silently accepted missing or insufficient original spend evidence.** The final helper receives total checkout coin funding and requires USED SPENT total times 100 to match it, rejects nonpositive spends, multiple source wallets and prior over-restoration, and removes clipping from the explicit branch. For funded policy-1 sales it loads the buyer wallet by `input.userId` and requires the source spend wallet to match it before mutations. Missing or unrelated wallets reject with 409 INVALID_REFUND_STATE. Legacy behavior and zero-funded sales retain their previous path. Read the current source and post-fix proof: `refund-worker-unit.log` records 61 passing focused tests; `new-races.log` records 11 passing PostgreSQL tests. The corruption regressions retain PROCESSING, no refund ledger entries, zero commission reversal, null walletPostedAt, unchanged buyer balance and unchanged unrelated wallet balance. No remaining actionable finding in this guard.

## Finding corrected during review

The snapshot earnings hook originally ran before refund audit/publication, while SUCCESS replay returned immediately after retrying earnings. An earnings failure after refund commit therefore lost those side effects. Root moved the first-completion hook after audit and best-effort publication; current `admin.service.ts:656-671` removes that specific failure window. SUCCESS replay remains snapshot-only and retries earnings idempotently. Legacy SUCCESS does not create new earnings.

## Reviewed paths

- Snapshot planner freezes original item cash/platform/coin components, reserves PENDING/PROCESSING/SUCCESS rights, excludes FAILED, rejects partial snapshots and non-full item quantities, and computes fee credits from successful actual cumulative merchandise reversal. Goods quantity/cash rights and shipping rights are bounded; full merchandise reverses the original fee.
- Refund completion holds the Order lock across reread, planning, state changes, cancellation/restock, sorted wallet locks, ledger posting, and buyer-coin changes. Post-earning debit and fee credit are atomic with SUCCESS. Unrecognized sales defer wallet effects; earnings later absorbs successful components and marks their allocations posted. Replay does not repeat ledger effects.
- Pre-shipment cancellation requires every shop item and unshipped evidence, restores committed inventory once, cancels item/shop/shipment state, and recomputes delivered/shipped remaining siblings. All canceled orders/payments become REFUNDED.
- Admin create/prepare/status routes use ADMIN role guards; service rechecks ADMIN, frozen scope ownership, and different processing/completing administrators. UI derives API types, edits pending plans before processing, refreshes server amounts, and requires a reference even for zero cash. Buyer allegation alone is not seller-fault authorization.
- Payout approval/payment acquire payout then wallet locks and recheck the ledger after existing reservations; the zero paid marker preserves prior reservation accounting. Seller debt uses backend economic balance including active reserves, so a reserved deficit is not mislabeled as economic debt.
- Migration is additive: four new snapshot/allocation tables, foreign keys and indexes, no historical updates/backfill. Snapshot provenance is independent of mutable coupon rows. New snapshot relations are optional on legacy scalar models.

## Limits

No external provider/bank evidence is established by a typed reference. Notifications retain best-effort delivery and no transactional outbox. Partial-unit returns remain deliberately unsupported in policy 1. Per-entry safe integer guards do not make arbitrarily large lifetime wallet aggregates exact; existing number summaries retain that documented boundary. Database/migration/runtime/browser verification is owned by the root's final gates; this report is source review, not independent execution evidence.

## Follow-up review

Strict policy-1 original funding and buyer-wallet ownership checks are resolved with current source and test proof as described above.

Current AdminService constructor has the optional seventh CacheInvalidation dependency, wired in the composition root. Postcommit SUCCESS and SUCCESS replay invalidate pre-shipment cancellation projections, then retry snapshot-only earnings. The final generated relation query and reader agree on `itemAllocations.itemSale.orderItem.shopId` and `itemSale.orderItem.variant.productId`; root corrected an earlier invalid direct OrderItem relation caught by its build. The cache invalidator covers catalog lists, search/suggestions, AI search, recommendations, product detail and seller dashboards. No source correctness issue found in the final addition. At review time actual PostgreSQL/Redis cache regression proof was pending; subsequent root verification is recorded below.

All four sold-count predicates (catalog metrics, search, recommendation, product analytics) exclude CANCELED items while requiring a SUCCEEDED parent. This preserves noncanceled delivered/refunded historical sales. Reviewed sold-worker-green.log: 12 tests passed, including three PostgreSQL tests; the literal partial-shop cancellation result is 13 to 9 for canceled-product quantity and 12 for its remaining sibling. Source and proof agree.

Root reports comment review complete: zero deletions and four retained public contracts. No application comments changed in this read-only review.

## Subsequent execution verification by root

`cache-worker-result.json` and `cache-worker-green.log` record one actual
PostgreSQL/Redis cache case passed with no skip. Final all-gates execution includes
that case: `final-all-vitest.json` records 1,374 passed and zero failed/pending.
Four Chromium flows, standalone typecheck and production build also passed. This
appendix is root execution evidence, not an independent reviewer rerun.
