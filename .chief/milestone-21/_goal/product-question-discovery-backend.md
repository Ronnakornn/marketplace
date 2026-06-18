# Goal: Product Q&A Discovery Backend

## Outcome

Product Q&A discovery on product detail pages must support backend-driven filtering, sorting, and pagination so buyers can find answered and unanswered questions predictably.

## Scope

- Extend the existing Q&A list API for `GET /api/products/:productId/questions`.
- Support question filters:
  - all questions
  - answered questions
  - unanswered questions
- Support sorting:
  - latest first
  - oldest first only if it is already low-cost in the repository implementation
- Support pagination:
  - page
  - limit
  - total count
  - next-page signal

## Constraints

- Only published questions and published answers for active products may be returned publicly.
- Seller answer creation and seller ownership validation must remain unchanged.
- Avoid N+1 queries and unnecessary relation loading.

## Non-Goals

- Do not build seller answer dashboard UX in this milestone.
- Do not add admin moderation changes in this milestone.
- Do not add voting/helpfulness features in this milestone.

