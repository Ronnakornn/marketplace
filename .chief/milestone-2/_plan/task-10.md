# task-10: Implement frontend seller route-guard staged transitions

## Goal

Apply staged buyer-to-seller route gating in frontend so onboarding routes and seller operational routes behave deterministically by seller state.

## Scope

- Update seller route decision logic to enforce:
  - no application or `DRAFT` -> `/seller/register`
  - `SUBMITTED` -> `/seller/status`
  - `APPROVED` without active shop -> `/seller/status`
  - `REJECTED` or `CANCELLED` -> direct `/seller/register`
  - active shop ready -> operational seller routes allowed
- Keep locale-aware redirects and existing guard call pattern intact.
- Ensure behavior is consistent across all seller pages using route guard enforcement.

## Relation to Existing Specs

- Extends [task-5](.chief/milestone-2/_plan/task-5.md) onboarding UX behavior with finalized permission-gating contract.
- Depends on [task-9](.chief/milestone-2/_plan/task-9.md) readiness semantics.

## Affected Areas

- Frontend route guard helpers:
  - `app/lib/seller-access.ts`
  - `app/lib/seller-route-guard.ts`
- Frontend route-guard tests:
  - `app/lib/seller-access.test.ts`
- Seller route entries that use guard behavior under:
  - `app/[locale]/seller/**/page.tsx`

## Implementation Notes

- Avoid duplicating state logic in page components; keep decisions in shared helper.
- Preserve deterministic redirects (no conflicting double-redirect behavior).
- Keep onboarding routes reachable for buyer-to-seller conversion states.
- Avoid broad page refactors unrelated to routing decisions.

## Verification

- Add/update focused frontend tests for complete transition matrix by status and active-shop state.
- Run:
  - `bunx tsc --noEmit`
  - focused seller access routing tests
