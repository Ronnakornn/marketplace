# Frontend Issue 002: Seller Route Guards And Navigation

## Impact

Seller route protection must use application/shop state, not user role.

## Tasks

- [x] Replace seller role helpers with seller access query/helper.
- [x] Redirect seller route states:
  - [x] no application/shop -> `/seller/register`
  - [x] submitted/rejected/cancelled -> `/seller/status`
  - [x] active shop -> operational routes
- [x] Keep seller sidebar hidden or disabled on onboarding/status pages where needed.
- [x] Add active shop selector if multi-shop support is enabled in v1.
- [x] Ensure localized paths work for `/th` and `/en`.

## Acceptance Criteria

- [x] `USER` with active shop can open seller dashboard.
- [x] `USER` with pending application lands on status page.
- [x] Admin-only routes remain admin protected.

## Implementation Notes

- Context window saved in `.issue/frontend/002-seller-route-guards-and-navigation-context.md`.
- Guard redirect rules are covered by `app/lib/seller-access.test.ts`.
