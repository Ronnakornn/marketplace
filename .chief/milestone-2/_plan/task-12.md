# task-12: Add regression coverage for frontend and backend permission-gating matrix

## Goal

Add focused regression tests to lock staged route behavior and operational API gating semantics across onboarding statuses and active-shop state.

## Scope

- Frontend regression coverage for route transitions:
  - register/status/operational route outcomes by seller application status
  - active-shop override behavior
- Backend regression coverage for operational API enforcement:
  - deny with `SELLER_ONBOARDING_REQUIRED` + `/seller/register` redirect hint
  - deny with `SELLER_SHOP_INACTIVE` + `/seller/status` redirect hint
  - allow when active owned shop readiness is satisfied
- Verify onboarding endpoint accessibility is preserved in buyer conversion states.

## Relation to Existing Specs

- Hardens behavior implemented in [task-10](.chief/milestone-2/_plan/task-10.md) and [task-11](.chief/milestone-2/_plan/task-11.md).
- Completes verification goals declared in permission-gating goal and contract artifacts.

## Affected Areas

- Frontend tests:
  - `app/lib/seller-access.test.ts`
- Backend tests (focused):
  - seller operational module tests under `server/modules/**`
  - `server/modules/auth/seller-authorization-contract.test.ts`
  - security/readiness tests under `server/modules/security/**`

## Implementation Notes

- Keep tests deterministic and table-driven where possible.
- Assert both response status and structured error contract payload (`code`, `details.redirectPath`).
- Cover status groups explicitly:
  - no application or `DRAFT`
  - `SUBMITTED`
  - `APPROVED` without active shop
  - `REJECTED` / `CANCELLED`
  - active shop ready
- Avoid broad e2e expansion; keep suite fast and focused.

## Verification

- Run:
  - `bunx tsc --noEmit`
  - focused frontend seller access routing tests
  - focused backend seller operational authorization tests
  - `bun run test` if shared contracts/helpers changed across modules
