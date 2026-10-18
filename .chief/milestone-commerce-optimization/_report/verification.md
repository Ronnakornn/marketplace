# Commerce optimization verification

Implemented all four scoped changes without database schema changes. Cart responses reuse the locked snapshot. Checkout batches promotion reads and revalidates only held candidates. Facets share their existing invalidation namespace across page/sort changes. Search/category routes seed matching first-page queries from the server.

## Passed checks

- Baseline focused suites: 185 tests passed before implementation.
- Cart focused suites: 49 passed, including ownership, reserved stock, consumed-cart rejection and lock-before-hydration behavior.
- Checkout focused suites: 88 passed, including mixed promotions, stable lock order, deactivation, quote changes, quota and buyer limits.
- Search/catalog/cache focused suites: 136 passed, 2 environment-dependent tests skipped in that run. New tests cover cache sharing, changed predicates, invalidation, exact bigint values and failure recovery.
- Frontend focused suites: 115 passed, including first-render product HTML, no duplicate first-page fetch, load-more, changed filters, locale mismatch and server-fetch recovery.
- Full default suite: 254 files passed, 55 skipped; 2,441 tests passed, 416 skipped. Log: `.audit/commerce-optimization-full-tests.log`.
- `bunx tsc --noEmit`: exit 0. Log: `.audit/commerce-optimization-typecheck.log`.
- Production Next build: exit 0. The task used `.next-commerce-optimization-build`; temporary additions Next made to tsconfig.json were removed.
- Real PostgreSQL/Redis integration: 32 tests passed in six suites in a clean final run. Log: `.audit/commerce-optimization-runtime/integration-clean.log`.
- Actual typed server listing loader against Elysia/PostgreSQL: 5 tests passed for both locales, category slug, price/sort and nonoverlapping pagination. Log: `.audit/commerce-optimization-runtime/listing-live-final.log`.
- Real PostgreSQL promotion selection: earliest-ending selection, duplicate variants and held-candidate restriction passed. Log: `.audit/commerce-optimization-runtime/flash-order-proof.log`.
- Independent design and final code reviewers found no actionable correctness defects. Two narration comments were removed. `git diff --check` passed.

## Limits and corrected attempts

No controlled latency/p95 comparison was run. Query-count and cache reuse tests prove removal of duplicate work; they do not quantify end-to-end speedup.

Automatic approval review rejected launching the isolated Next dev server with `blocked by policy`. No bypass was attempted. Live browser smoke remains unverified; production build, real component HTML tests and the actual server loader/API checks passed.

Initial runtime attempts hit test-environment guards for PostgreSQL port and Redis DB, then one Redis connection failure; the final six-suite run passed. An initial category proof incorrectly sent a UUID to the existing slug filter. The evidence fixture was corrected to the route's slug without changing its row assertions; all five live checks then passed. Raw failed logs remain beside the final logs.
