# task-4: Extend seller dashboard with shop insights

## Goal

Extend seller dashboard with shop insight metrics and bounded review-oriented reads while preserving milestone-1 performance and cache safety.

## Scope

- Extend existing dashboard responses with optional shop insight fields where practical.
- Add dedicated endpoints for heavier insight reads (for example review-oriented lists) with bounded limits.
- Keep dashboard data strictly shop-scoped for active owned shops and multi-shop contexts.
- Wire cache invalidation paths for mutations that materially impact dashboard insights.

## Affected Areas

- `server/modules/seller/seller-dashboard.routes.ts`
- `server/modules/seller/seller-dashboard.service.ts`
- `server/modules/seller/seller-dashboard.repository.ts`
- cache key and invalidation helpers:
  - `server/modules/cache/**`
- related seller dashboard tests

## Implementation Notes

- Preserve backward compatibility for existing dashboard endpoints.
- Avoid N+1 patterns and cap heavy read limits.
- Keep cache keys shop-scoped and resolved only after auth and ownership checks.
- Ensure insight data does not leak across shops for multi-shop users.

## Verification

- Add or update focused tests for:
  - dashboard insight authorization and shop scoping
  - bounded limit validation on heavy endpoints
  - cache key isolation and invalidation after related mutations
- Run:
  - `bunx tsc --noEmit`
  - focused seller dashboard and cache-related tests
