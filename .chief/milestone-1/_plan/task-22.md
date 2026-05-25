# task-22: Verify product UI data fetching, audience separation, invalidation behavior, and type safety

## Goal

Perform final verification for the product UI data fetching milestone extension and clean up temporary compatibility code where possible.

## Scope

- Review the implementation against:
  - product UI data fetching goal
  - product UI data fetching contract
  - buyer entry performance contract
  - seller product CRUD contract
- Run focused frontend tests for product query layer and affected UI surfaces.
- Run affected backend catalog/search tests if route typing or response contracts changed.
- Run typecheck.
- Remove temporary diagnostics or obsolete product fetch helpers that are no longer used.

## Implementation Notes

- Verify public/buyer, seller, admin, and affiliate product query paths do not share unsafe cache keys.
- Verify demo/fallback products are not rendered in production product UI paths.
- Verify product visibility/status rules remain enforced by endpoint usage.
- Verify mutation invalidation refreshes affected product UI without relying only on unrelated broad invalidations.
- Document any intentionally retained adapter/normalizer and why it still exists.

## Verification

- Run focused product UI tests.
- Run focused seller/admin product tests.
- Run affected backend catalog/search tests if backend route changes occurred.
- Run `bunx tsc --noEmit`.
- Record notable verification results in the task completion notes or milestone report if the chief workflow requires it.
