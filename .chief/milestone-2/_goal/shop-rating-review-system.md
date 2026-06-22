# Shop Rating and Review System Goal

## Objective

Deliver a practical shop-level rating and review capability that supports buyer trust and seller feedback loops with moderation safeguards.

## Scope

- Implement shop review lifecycle for eligible buyers:
  - create review tied to eligible completed purchase context
  - list shop reviews
  - show shop rating summary
- Use moderation-first publication flow for new shop reviews:
  - pending state before public visibility
  - approved state for visible content
- Surface review summary in seller dashboard and buyer shop-facing contexts where relevant.
- Keep review ownership and anti-duplicate safeguards aligned with existing review domain rules.
- Ensure Thai and English user-facing strings are supported for new review UI states in this milestone.

## Success Criteria

- Eligible buyers can submit shop reviews and ratings with clear status feedback.
- Publicly visible shop review content respects moderation status.
- Shop rating aggregates stay consistent with review state transitions.
- Sellers can observe rating trends through dashboard-oriented summary views.
- Cross-shop or unauthorized review mutation/read paths are rejected.

## Out of Scope

- Full sentiment analysis or AI moderation.
- Seller public reply threads to reviews in this milestone.
- Advanced ranking algorithms based on review velocity.

## Verification Goal

- Add focused tests for eligibility, duplicate prevention, moderation gating, and summary aggregation.
- Add focused tests for shop-scoped authorization on review read/write paths.
- Run `bunx tsc --noEmit`.
