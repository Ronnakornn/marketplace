# Seller Area Performance Goal

## Objective

Reduce the user-visible delay when opening seller pages, starting with `/th/seller`.

## Scope

- Focus on the seller area:
  - `/seller`
  - `/seller/register`
  - `/seller/status`
  - seller operational subroutes such as products, inventory, orders, finance, chat, and notifications
- Cover both frontend route/render behavior and seller dashboard API/query/cache behavior.
- Do not redesign the seller UI or introduce broad global state changes unless required to remove a measured bottleneck.

## Success Criteria

- Seller pages should avoid blank or long "Rendering" states caused by repeated route fetches, duplicate auth checks, duplicate seller access queries, or avoidable dashboard API work.
- Seller navigation should render consistently on operational seller routes.
- Dashboard metrics may be briefly stale when this reduces repeated database work.

## Cache Policy

- Seller dashboard summary data may use short-lived caching, approximately 15 to 60 seconds.
- Cache behavior must not bypass ownership checks.
- Mutations that materially change seller dashboard data should invalidate or bypass stale dashboard data where practical.

## Verification Goal

- Capture local evidence before and after implementation for request count or render timing on `/th/seller`.
- Run focused tests for seller routing/onboarding and relevant seller dashboard behavior.
- Run `bunx tsc --noEmit`.
- Do not leave temporary debug logging or measurement code in production paths.
