# task-9: Define shared seller-readiness helper and centralized rejection contract

## Goal

Define one shared seller-readiness gate contract that can be reused by frontend and backend, including deterministic rejection codes and redirect metadata.

## Scope

- Introduce a shared seller-readiness decision helper for onboarding vs operational access states.
- Standardize readiness outcomes from seller state inputs:
  - has active shop
  - latest seller application status
- Define centralized rejection payload mapping for operational API denial:
  - `SELLER_ONBOARDING_REQUIRED`
  - `SELLER_SHOP_INACTIVE`
  - deterministic `redirectPath`
- Keep contract additive and backward compatible where legacy codes still exist during rollout.

## Relation to Existing Specs

- Extends [task-2](.chief/milestone-2/_plan/task-2.md) and [task-6](.chief/milestone-2/_plan/task-6.md) by turning onboarding/shop-readiness rules into reusable gate logic.
- Prepares implementation baseline for [task-10](.chief/milestone-2/_plan/task-10.md) and [task-11](.chief/milestone-2/_plan/task-11.md).

## Affected Areas

- Backend shared security module:
  - `server/modules/security/active-shop.ts`
  - `server/modules/security/security.errors.ts`
  - `server/modules/security/index.ts`
  - new shared readiness helper file(s) under `server/modules/security/**`
- Frontend seller access helpers (for contract parity):
  - `app/lib/seller-access.ts`

## Implementation Notes

- Do not introduce `withRole: 'SELLER'` checks.
- Keep logic identity + ownership + active-shop based.
- Readiness contract must map status classes consistently:
  - onboarding-required group -> `/seller/register`
  - waiting-review/activation group -> `/seller/status`
  - active-shop-ready group -> operational access allowed
- Ensure helper output is deterministic and easy to assert in tests.

## Verification

- Add focused unit tests for readiness decision matrix and error metadata mapping under security module tests.
- Run:
  - `bunx tsc --noEmit`
  - focused security/readiness test suite
