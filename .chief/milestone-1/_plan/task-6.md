# task-6: Optimize public home and search data fetching/cache behavior

## Goal

Reduce repeated public data work for home and search pages while preserving API compatibility and public/private data boundaries.

## Scope

- Review marketplace home, product listing/search, category, and product API data paths.
- Add or refine short-lived server/API caching only for public product/category/search data.
- Ensure cache keys include locale, query, category, filters, sort, and pagination inputs.
- Do not cache auth, cart, checkout, order, payment, seller, or admin private data.

## Likely Files

- `server/modules/catalog/*`
- `server/modules/search/*`
- `server/modules/cache/*`
- `app/features/marketplace/*`
- `app/features/product/*`
- localized public route files under `app/[locale]/(public)/**`
- focused tests for changed backend cache/search behavior

## Steps

1. Inspect current home/search data fetch paths and cache usage.
2. Identify duplicate or uncached public queries from task-5 evidence.
3. Add or adjust short-lived cache only where keys can be complete and safe.
4. Preserve endpoint response shapes and frontend inferred types.
5. Add focused tests for cache key completeness and public/private boundary safety.

## Verification

- Changed cache/search/catalog tests pass.
- Existing endpoint consumers remain compatible.
- `bunx tsc --noEmit` passes in task-8.
