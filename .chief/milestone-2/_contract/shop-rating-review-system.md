# Shop Rating and Review System Contract

## Scope Contract

- Shop review capability is separate from product review capability and must not regress existing product review routes.
- Shop review flow in this milestone covers:
  - buyer create review for eligible shop order context
  - list shop reviews
  - shop rating summary
  - moderation-gated publication

## Eligibility and Integrity Contract

- Buyer can review a shop only from eligible purchase context tied to that shop.
- Duplicate prevention must enforce one review per buyer per eligible shop order context per business rule.
- Review mutations require authenticated buyer context with ownership validation.
- Admin moderation controls publication state.

## Moderation Contract

- New shop reviews default to `PENDING` visibility state.
- Public listing/summary only includes moderation-approved records.
- Moderation actions remain admin-only and auditable.

## API Contract

- Existing review module may be extended for shop review endpoints; endpoint naming must remain clear between product vs shop review surfaces.
- Product review endpoints remain backward compatible and behavior-stable.
- New shop review responses should include enough fields for:
  - seller dashboard summary signals
  - buyer-facing shop rating display
- Response shapes may be extended, not broken.

## Rating Aggregation Contract

- `Shop.ratingAverage` and `Shop.ratingCount` must stay consistent with moderation-visible shop reviews.
- Aggregate updates must be transaction-safe and resilient to duplicate writes.
- Aggregation logic must not trust client-side aggregate payloads.

## Security Contract

- Shop review write routes use `{ withAuth: true }`.
- Admin moderation routes use `{ withRole: 'ADMIN' }`.
- Cross-shop unauthorized writes/reads must be rejected.

## Localization and UX Contract

- Review-related user-facing states and errors support Thai and English for this milestone.
- Review UI must expose clear pending/approved state semantics where applicable.

## Verification Contract

- Add focused tests for eligibility, duplicate protection, pending-to-approved moderation flow, and summary aggregation.
- Add focused tests ensuring public shop summary excludes non-approved records.
- Add focused tests for auth/ownership/admin boundary on review routes.
- Run `bunx tsc --noEmit`.
