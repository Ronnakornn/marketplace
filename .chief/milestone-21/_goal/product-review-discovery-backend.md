# Goal: Product Review Discovery Backend

## Outcome

Product review discovery on product detail pages must support backend-driven filtering, sorting, and pagination so buyers can inspect review evidence without loading every review client-side.

## Scope

- Extend the existing review list API for `GET /api/products/:productId/reviews`.
- Support review filters:
  - rating
  - has media
  - has comment
- Support review sorting:
  - latest
  - rating high
  - rating low
- Support pagination:
  - page
  - limit
  - total count
  - next-page signal

## Constraints

- Do not trust client-provided product or review state.
- Only published reviews for active products may be returned publicly.
- Keep review ownership, creation, update, and deletion behavior unchanged.
- Avoid loading unnecessary relations and avoid N+1 queries.

## Non-Goals

- Do not add review creation/editing UX in this milestone.
- Do not add review reporting/moderation changes in this milestone.
- Do not introduce fake verified-purchase fields. Use existing purchased item snapshot data only.

