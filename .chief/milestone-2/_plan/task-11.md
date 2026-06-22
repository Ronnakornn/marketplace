# task-11: Enforce backend seller operational API gating with deterministic rejection codes

## Goal

Enforce seller-readiness checks on backend operational seller APIs while preserving onboarding endpoint accessibility for buyer-to-seller conversion.

## Scope

- Apply seller-readiness gate to seller operational API surface, including:
  - `/api/seller/dashboard*`
  - `/api/seller/shops*`
  - `/api/seller/wallet*`
  - `/api/seller/shipments*` (and other seller operational modules in current route set)
  - seller product-management endpoints under `/api/seller/*`
- Keep onboarding endpoints explicitly reachable:
  - `/api/seller/application`
  - `/api/seller/application/draft`
  - `/api/seller/application/submit`
  - status-read endpoints used by onboarding flow
- Return centralized, deterministic denial codes and metadata:
  - `SELLER_ONBOARDING_REQUIRED`
  - `SELLER_SHOP_INACTIVE`
  - `redirectPath`

## Relation to Existing Specs

- Extends [task-4](.chief/milestone-2/_plan/task-4.md), [task-6](.chief/milestone-2/_plan/task-6.md), and operational modules from [task-2](.chief/milestone-2/_plan/task-2.md).
- Depends on [task-9](.chief/milestone-2/_plan/task-9.md) shared readiness/error contract.

## Affected Areas

- Shared readiness/security integration:
  - `server/modules/security/**`
- Seller operational modules (initial scope):
  - `server/modules/seller/seller-dashboard.routes.ts`
  - `server/modules/catalog/catalog.routes.ts` (seller product endpoints)
  - `server/modules/seller-shop/seller-shop.routes.ts`
  - `server/modules/wallet/wallet.routes.ts`
  - `server/modules/shipment/shipment.routes.ts`
  - `server/modules/order/order.routes.ts` (seller endpoints)
  - `server/modules/promotion/promotion.routes.ts` (seller endpoints)
  - `server/modules/return/return.routes.ts` (seller endpoints)
  - `server/modules/payout/payout.routes.ts` (seller endpoints)
- Authorization contract tests:
  - `server/modules/auth/seller-authorization-contract.test.ts`

## Implementation Notes

- Keep route auth macro as `{ withAuth: true }`; do not add `withRole: 'SELLER'`.
- Prefer shared guard helper/plugin usage over duplicating conditional checks per handler.
- Ensure rejection payload structure is stable and additive for existing consumers.
- Maintain ownership and shop-scoped safety; no cross-shop leakage.

## Verification

- Add/update focused backend tests for allow/deny matrix by onboarding status and active-shop readiness.
- Assert rejection code plus `redirectPath` metadata shape.
- Run:
  - `bunx tsc --noEmit`
  - focused seller operational API tests
  - focused auth/seller authorization contract tests
