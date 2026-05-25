# task-6: Optimize public home and search data fetching/cache behavior

## Summary

Reviewed the buyer home/search public data paths against the task-5 baseline. The main visible delay remains client render/hydration, not backend API latency, so this task avoided broad backend refactors.

Existing safe cache coverage was already present for:

- `GET /api/products` via `CatalogService.listPublicProducts`
- `GET /api/products/:productId` via `CatalogService.getPublicProductDetail`
- `GET /api/categories` via `CatalogService.listCategories`
- `GET /api/search/products` via `SearchService.searchProducts`

The measured gap was `GET /api/search/suggestions`, which is public search data, depends only on query/limit/locale, and measured around 44 ms in task-5. Added short-lived search TTL caching for suggestions.

## Changes

- Added `searchSuggestions(query)` to the cache key builder.
- Cached `SearchService.getSuggestions` with the existing conservative search TTL.
- Included `q`, `limit`, and normalized `locale` in the suggestions cache input.
- Extended product/search invalidation to clear suggestion caches because suggestions are derived from product titles.
- Added focused tests for:
  - suggestions caching by query/limit/locale
  - search cache key variation by behavior-changing inputs
  - suggestion cache invalidation on product updates
  - no cart/checkout/payment cache key builders

## Public/Private Boundary

No auth, cart, checkout, order, payment, seller, or admin private data was cached. The new cache only stores public search suggestions returned by `/api/search/suggestions`.

## API Compatibility

Endpoint response shapes were preserved. No frontend API types or response normalization behavior changed.

## Verification

- `bun run test server/modules/cache/cache.service.test.ts` passed.
- `bun run test server/modules/search/search.service.test.ts` passed.
- `bunx tsc --noEmit` passed.

Note: direct `bun test` was not used for final verification because existing tests rely on Vitest helpers such as `vi.mocked`; the repository script runs `vitest run`.
