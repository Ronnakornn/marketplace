# Seller Performance Contract

## Seller Access Contract

- Seller route protection must continue to use authenticated server-side checks.
- Seller access checks must preserve these states:
  - active shop owners may access operational seller routes
  - users with no seller application or a draft application go to `/seller/register`
  - users with submitted, approved-without-active-shop, rejected, or cancelled applications go to `/seller/status`
- Seller authorization must not rely on a `SELLER` user role.
- Seller route optimization must not weaken ownership validation or expose seller/admin-only data.

## Routing and Rendering Contract

- Seller route redirects must be deterministic for the current route and locale.
- Seller shell navigation must be visible on operational seller routes such as `/seller`, `/seller/products`, `/seller/orders`, and `/seller/finance`.
- Seller shell navigation must remain hidden on onboarding/status routes unless a later approved UX goal changes that.
- Link prefetch changes are allowed when they prevent avoidable protected-route fetches or redirect loops.

## Seller Dashboard API Contract

- Existing seller dashboard endpoints and response shapes must remain compatible:
  - `GET /api/seller/dashboard`
  - `GET /api/seller/dashboard/sales-summary`
  - `GET /api/seller/dashboard/recent-orders`
  - `GET /api/seller/dashboard/low-stock`
- Dashboard data must remain scoped to the authenticated seller's active shop or shops.
- Dashboard repository queries must avoid N+1 access patterns and unnecessary relation loading.
- Query changes must preserve marketplace invariants around shop ownership, orders, shipments, products, and inventory.

## Caching Contract

- Seller dashboard summary data may be cached for a short TTL between 15 and 60 seconds.
- Cache keys must include the seller shop scope and must not share data across sellers.
- Cache reads must occur only after authentication and seller shop resolution.
- Mutations that change seller dashboard-visible data should invalidate the relevant seller cache where practical.

## Verification Contract

- Performance verification must include local evidence for `/th/seller`, such as request count, render timing, or before/after observations.
- Focused automated verification must include seller routing/access tests and any changed dashboard service/cache tests.
- `bunx tsc --noEmit` must pass.
- Temporary diagnostic logs, counters, or scripts must not remain in production execution paths unless explicitly documented as permanent observability.
