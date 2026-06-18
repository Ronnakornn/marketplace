# task-3: Frontend Listing Metadata and Load More State

## Objective

Update product query normalization and listing page state so buyer listing/search can use API metadata, append load-more results, dedupe product IDs, and retry next-page failures.

## Scope

- `app/features/product/queries.ts`
- `app/features/product/components/ProductListingPage.tsx`
- Focused product listing tests.

## Required Behavior

- Normalize both old and new response shapes:
  - array
  - `{ data, meta }`
  - `{ items, meta, facets }`
- Expose normalized listing data containing:
  - products
  - meta
  - facets
- Initial page loads page 1.
- Load more fetches next page and appends results.
- Rendered grid must dedupe by product ID.
- Next-page loading must not replace current results with the full-page skeleton.
- Next-page failure must show retry without losing current results.
- Changing query/filter/sort resets accumulated results.

## Constraints

- No numbered pagination.
- No automatic infinite scroll.
- URL query params remain source of truth for base query/filter/sort.
- Keep using TanStack Query and Eden-inferred API types.

## Verification

- Add/update frontend query normalization tests.
- Add/update listing UI tests for result count, load-more append, dedupe, and retry.
- Run:

```bash
bun run test app/features/product
bunx tsc --noEmit
```
