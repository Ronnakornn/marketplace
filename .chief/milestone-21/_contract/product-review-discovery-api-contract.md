# Product Review Discovery API Contract

## Contract

`GET /api/products/:productId/reviews` must support paginated public review discovery while preserving existing review card fields.

## Query Parameters

- `rating?: number`
  - Optional integer from 1 to 5.
  - When present, return only published reviews with that rating.
- `hasMedia?: boolean`
  - When `true`, return only reviews with at least one public review media item.
- `hasComment?: boolean`
  - When `true`, return only reviews with a non-empty body/comment.
- `sort?: "latest" | "rating_desc" | "rating_asc"`
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
  items: ReviewResponse[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    hasNextPage: boolean;
  };
}
```

`ReviewResponse` must preserve existing fields used by product detail:

- `id`
- `productId`
- `orderItemId`
- `userId`
- `userName`
- `rating`
- `comment`
- `images`
- `media`
- `status`
- `createdAt`
- `updatedAt`
- `snapshot`

## Repository Behavior

- Filter to published reviews for the requested active product.
- Count must match the applied filters.
- Sorting must be stable enough for pagination; include a deterministic tie-breaker such as `createdAt`/`id`.
- Media filter must not load every review into memory to test media count.
- Comment filter must treat null and whitespace-only comments as absent.

## Backward Compatibility

- Existing callers that assume an array must be updated through frontend normalizers/tests.
- Review creation/update/delete routes must not change.
- Rating summary endpoint must not change in this milestone.

## Acceptance

- Route tests cover default list, rating filter, media/comment filters, sort, pagination meta, and invalid query validation.
- Service/repository tests cover filtering/counting without changing review ownership rules.

