# Task 3: Product Frontend Query Contracts

## Objective

Update product frontend query helpers to consume paginated review and Q&A responses with filter/sort/page inputs.

## Affected Areas

- `app/features/product/queries.ts`
- `app/features/product/queries.test.ts`
- Any product detail tests that mock review or question query options.

## Requirements

- Add typed input objects for public review and Q&A discovery queries.
- Review query input must include:
  - `productId`
  - `rating`
  - `hasMedia`
  - `hasComment`
  - `sort`
  - `page`
  - `limit`
- Q&A query input must include:
  - `productId`
  - `answerStatus`
  - `sort`
  - `page`
  - `limit`
- Query keys must include product id, filters, sort, page, and limit.
- API callers must send params to the existing Eden Treaty routes.
- Normalizers must support the new `{ items, meta }` response shape.
- Keep tolerant fallback for legacy array response fixtures where reasonable.

## Suggested Types

- `BuyerPaginatedMeta`
- `BuyerProductReviewsPage`
- `BuyerProductQuestionsPage`

## Tests

- Query-key tests prove filters/sort/page/limit affect review and Q&A keys.
- Normalizer tests cover:
  - new paginated review response
  - legacy review array fallback
  - new paginated Q&A response
  - legacy Q&A array/items fallback
  - malformed meta fallback.

## Done When

- Product query tests pass.
- Product detail can request paginated reviews and questions without manually duplicated backend response types.

