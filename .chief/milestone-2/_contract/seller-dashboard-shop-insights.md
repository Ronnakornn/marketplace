# Seller Dashboard Shop Insights Contract

## Endpoint Contract

- Existing dashboard endpoints stay compatible:
  - `GET /api/seller/dashboard`
  - `GET /api/seller/dashboard/sales-summary`
  - `GET /api/seller/dashboard/recent-orders`
  - `GET /api/seller/dashboard/low-stock`
- New dashboard insight endpoints may be added for heavier reads, such as review-oriented lists, without forcing oversized base dashboard payloads.
- Existing consumers must not break when new insight fields are introduced.

## Authorization and Scope Contract

- Dashboard routes use `{ withAuth: true }`.
- Data remains scoped to authenticated seller owned active shop context.
- Multi-shop users must not receive mixed or leaked metrics across unselected/non-owned shops.

## Metrics Contract

- Dashboard shop insight coverage may include:
  - shop status/profile completeness indicators
  - rating summary signals
  - operational alerts requiring seller action
- Derived metrics must come from trusted backend sources only.
- No client-provided metric values are trusted.

## Cache Contract

- Existing short-lived cache policy remains valid for dashboard summaries.
- Cache keys must include shop scope.
- Cache reads occur only after auth and seller shop resolution.
- Mutations that materially affect dashboard/shop insights should invalidate relevant cache keys where practical.

## Performance Contract

- Dashboard extension must avoid introducing N+1 query patterns.
- Heavier lists should be paginated or limit-bounded.
- Existing seller performance gains from milestone-1 must be preserved.

## Verification Contract

- Add focused tests for shop-scoped dashboard insights and authorization boundaries.
- Add focused tests for cache key isolation and invalidation when shop/review data changes.
- Add focused tests for limit bounds on heavier dashboard insight reads.
- Run `bunx tsc --noEmit`.
