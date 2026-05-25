# task-3: Optimize seller dashboard API queries and short-lived caching

## Goal

Reduce dashboard API/database cost without changing seller dashboard response shape or weakening seller ownership boundaries.

## Scope

- Review seller dashboard service/repository query count and selected relations.
- Avoid N+1 and unnecessary relation loading.
- Use short-lived shop-scoped caching for dashboard summary data where appropriate.
- Invalidate relevant seller dashboard cache from mutations where practical.

## Likely Files

- `server/modules/seller/seller-dashboard.service.ts`
- `server/modules/seller/seller-dashboard.repository.ts`
- `server/modules/seller/seller-dashboard.routes.ts`
- `server/modules/cache/*`
- seller mutation services that affect dashboard-visible data, if cache invalidation is added
- `server/modules/seller/seller-dashboard.service.test.ts`
- `server/modules/cache/cache.service.test.ts`

## Steps

1. Inspect existing dashboard queries for duplicate work or over-fetching.
2. Preserve existing endpoint contracts and response shapes.
3. Apply short TTL caching only after auth and seller shop resolution.
4. Ensure cache keys are shop-scoped and cannot leak between sellers.
5. Add or update tests for cache key behavior and dashboard ownership boundaries.

## Verification

- Seller dashboard service tests pass.
- Cache tests pass if changed.
- Existing seller dashboard endpoints remain compatible.
- No seller/admin/private data is exposed across users.
