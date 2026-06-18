# Task 1: Review Discovery Backend

## Objective

Extend public product review discovery with backend filtering, sorting, pagination, and tests.

## Affected Areas

- `server/modules/review/review.routes.ts`
- `server/modules/review/review.service.ts`
- `server/modules/review/review.repository.ts`
- `server/modules/review/*.test.ts`

## Requirements

- Add query validation for `GET /api/products/:productId/reviews`:
  - `rating?: 1 | 2 | 3 | 4 | 5`
  - `hasMedia?: boolean`
  - `hasComment?: boolean`
  - `sort?: "latest" | "rating_desc" | "rating_asc"`
  - `page?: number`
  - `limit?: number`
- Default `sort` to `latest`, `page` to `1`, and `limit` to `5`.
- Clamp or validate `limit` with max `20`; prefer validation error for invalid values if that matches local route style.
- Return `{ items, meta }` with `page`, `limit`, `totalCount`, and `hasNextPage`.
- Preserve every existing `ReviewResponse` field used by frontend.
- Keep rating summary, create, update, and delete behavior unchanged.

## Repository Notes

- Filter published reviews for active products only.
- Use database-level filtering for rating, media existence, and comment existence.
- Count with the same where clause used for the item query.
- Use deterministic order:
  - latest: `createdAt desc`, then `id desc`
  - rating high: `rating desc`, then `createdAt desc`, then `id desc`
  - rating low: `rating asc`, then `createdAt desc`, then `id desc`
- Do not introduce N+1 queries.

## Tests

- Route test: default response shape returns `{ items, meta }`.
- Route test: invalid query values fail validation.
- Service/repository tests:
  - rating filter
  - has-media filter
  - has-comment filter
  - each supported sort
  - pagination count and `hasNextPage`
  - create/update/delete ownership behavior still passes existing tests.

## Done When

- Focused review module tests pass.
- Response shape matches `product-review-discovery-api-contract.md`.

