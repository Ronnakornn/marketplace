# Product Q&A Discovery API Contract

## Contract

`GET /api/products/:productId/questions` must support paginated public Q&A discovery while preserving existing question and answer fields.

## Query Parameters

- `answerStatus?: "all" | "answered" | "unanswered"`
  - Default: `all`.
  - `answered` returns questions with at least one published answer.
  - `unanswered` returns questions with no published answers.
- `sort?: "latest" | "oldest"`
  - Default: `latest`.
- `page?: number`
  - 1-based.
  - Default: `1`.
- `limit?: number`
  - Default: `5`.
  - Maximum: `20`.

## Response Shape

The endpoint must return:

```ts
{
  items: ProductQuestionResponse[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    hasNextPage: boolean;
  };
}
```

`ProductQuestionResponse` must preserve existing fields:

- `id`
- `productId`
- `shopId`
- `question`
- `status`
- `createdAt`
- `user`
- `answers`

## Repository Behavior

- Only return published questions for active products and active shops.
- Only include published answers.
- Count must match the applied answer-status filter.
- Sorting must include a deterministic tie-breaker.
- Answered/unanswered filtering must be done in the database query, not after loading all questions.

## Backward Compatibility

- Question creation and seller answer creation routes must not change.
- Existing frontend normalizers may continue accepting array responses as a fallback, but product detail should consume the new `{ items, meta }` shape.

## Acceptance

- Route tests cover default list, answered/unanswered filters, sort, pagination meta, and invalid query validation.
- Service/repository tests cover published-only behavior, answer filtering, and pagination count.

