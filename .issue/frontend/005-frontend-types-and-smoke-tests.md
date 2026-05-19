# Frontend Issue 005: Frontend Types And Smoke Tests

## Impact

Schema/API changes require regenerated inferred types and frontend smoke coverage.

## Tasks

- Regenerate Eden/Prisma/Prismabox types after backend contract alignment.
- Update seller/admin hooks for application endpoints.
- Add smoke tests for:
  - onboarding draft
  - submit pending state
  - rejected resubmit path
  - admin approve/reject
  - active seller dashboard redirect
  - buyer cart/checkout visible for active seller
- Add visual checks for mobile onboarding/status/admin review layouts.

## Acceptance Criteria

- Typecheck passes.
- Seller onboarding and admin review smoke tests pass.
- No frontend code imports or checks `SELLER` as a `User.role`.
