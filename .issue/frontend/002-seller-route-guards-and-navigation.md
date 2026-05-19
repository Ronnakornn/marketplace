# Frontend Issue 002: Seller Route Guards And Navigation

## Impact

Seller route protection must use application/shop state, not user role.

## Tasks

- Replace seller role helpers with seller access query/helper.
- Redirect seller route states:
  - no application/shop -> `/seller/register`
  - submitted/rejected/cancelled -> `/seller/status`
  - active shop -> operational routes
- Keep seller sidebar hidden or disabled on onboarding/status pages where needed.
- Add active shop selector if multi-shop support is enabled in v1.
- Ensure localized paths work for `/th` and `/en`.

## Acceptance Criteria

- `USER` with active shop can open seller dashboard.
- `USER` with pending application lands on status page.
- Admin-only routes remain admin protected.
