# Task 2: Product Q&A Discovery Backend

## Objective

Extend public product question discovery with backend answered/unanswered filters, sorting, pagination, and tests.

## Affected Areas

- `server/modules/product-question/product-question.routes.ts`
- `server/modules/product-question/product-question.service.ts`
- `server/modules/product-question/product-question.repository.ts`
- `server/modules/product-question/*.test.ts`

## Requirements

- Add query validation for `GET /api/products/:productId/questions`:
  - `answerStatus?: "all" | "answered" | "unanswered"`
  - `sort?: "latest" | "oldest"`
  - `page?: number`
  - `limit?: number`
- Default `answerStatus` to `all`, `sort` to `latest`, `page` to `1`, and `limit` to `5`.
- Limit maximum must be `20`.
- Return `{ items, meta }` with `page`, `limit`, `totalCount`, and `hasNextPage`.
- Preserve existing question and answer response fields.
- Keep question creation and seller answer creation unchanged.

## Repository Notes

- Only return published questions for active products and active shops.
- Only include published answers.
- Apply answered/unanswered filtering in the database:
  - answered: at least one published answer
  - unanswered: no published answers
- Count with the same where clause used for item query.
- Use deterministic order:
  - latest: `createdAt desc`, then `id desc`
  - oldest: `createdAt asc`, then `id asc`
- Avoid N+1 queries.

## Tests

- Route test: default response shape returns `{ items, meta }`.
- Route test: invalid query values fail validation.
- Service/repository tests:
  - answered filter
  - unanswered filter
  - latest and oldest sort
  - pagination count and `hasNextPage`
  - published-only questions and answers.

## Done When

- Focused product-question module tests pass.
- Response shape matches `product-question-discovery-api-contract.md`.

