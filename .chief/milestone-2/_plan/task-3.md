# task-3: Implement shop rating and review lifecycle

## Goal

Deliver shop-level rating and review write/read flows with moderation-first publication and reliable aggregate updates.

## Scope

- Add shop review create flow for eligible buyers tied to valid shop order context.
- Add shop review listing and rating summary read flows.
- Add or extend admin moderation actions for pending shop reviews.
- Ensure only approved reviews affect public visibility and aggregate summaries.
- Keep product review behavior stable and backward compatible.

## Affected Areas

- `server/modules/review/**` and related repository contracts
- any shop aggregate update paths touching Shop rating fields
- admin moderation routes/services if shop review moderation endpoints are introduced or extended
- review-related tests across buyer and admin boundaries

## Implementation Notes

- Reuse existing review models and status semantics where possible.
- Enforce duplicate prevention and ownership checks at backend layer.
- Aggregate updates for `Shop.ratingAverage` and `Shop.ratingCount` must be transaction-safe.
- Keep public read logic moderation-aware (approved only).
- Do not trust client-provided aggregate values.

## Verification

- Add or update focused tests for:
  - review eligibility checks
  - duplicate prevention
  - pending-to-approved publication flow
  - aggregate correctness after moderation transitions
  - auth boundaries for buyer vs admin actions
- Run:
  - `bunx tsc --noEmit`
  - focused review and admin review-moderation test suites
