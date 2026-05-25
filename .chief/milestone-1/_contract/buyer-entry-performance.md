# Buyer Entry Performance Contract

## Route and UI Contract

- Buyer entry route optimizations apply to localized routes such as `/th` and `/th/search`.
- Existing locale behavior must be preserved.
- Existing public page behavior and links must remain compatible.
- UI changes should reduce blank/loading states without replacing the current buyer experience or redesigning the page.

## Public Data Contract

- Public product, category, and search data may be cached.
- Private or user-scoped data must not be cached by public entry-page cache keys, including:
  - auth/session data
  - cart contents
  - checkout state
  - orders
  - payment state
  - seller/admin private data
- Product visibility and status rules must remain enforced.
- Search/listing results must remain paginated.

## Cache Key Contract

- Cache keys for buyer entry data must include every input that can change the result:
  - locale
  - query text
  - category
  - filters
  - sort
  - cursor/page/limit
- Cache keys must not include raw sensitive data.
- Cache TTLs should be short and explicit.
- Cache failures must fail open without breaking page rendering.

## API Compatibility Contract

- Existing public product/category/search endpoints and frontend consumers must remain compatible.
- Frontend types must continue to be inferred from existing API clients rather than duplicated manually.
- Backend validation must continue to use established TypeBox/Prismabox patterns where route validation changes are needed.

## Verification Contract

- Verification must capture local before/after evidence for `/th` and `/th/search`.
- Verification must include browser-level visible render evidence, not only HTTP timing.
- Focused tests must cover changed public cache/search behavior.
- `bunx tsc --noEmit` must pass.
- Temporary measurement code must stay under `.chief/milestone-1/_report/` or be removed before completion.
