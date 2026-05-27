# Seller Dashboard Shop Insights Goal

## Objective

Extend seller dashboard capability with shop-centric KPIs and review-aware insights while preserving existing performance and cache behavior.

## Scope

- Keep existing dashboard endpoint compatibility and extend with new optional insight fields where practical.
- Add focused dashboard sub-endpoints for heavier or more dynamic data, such as review-related lists.
- Include core shop metrics in dashboard surfaces, such as:
  - shop status and profile completeness signals
  - rating summary indicators
  - operational alerts relevant to seller action
- Preserve existing short-lived cache strategy and ownership-safe cache scoping.

## Success Criteria

- Seller dashboard exposes actionable shop KPIs without regressing route responsiveness.
- Heavy dashboard data is isolated behind dedicated reads instead of forcing one oversized response.
- Dashboard data remains shop-scoped and safe for multi-shop usage.
- Cache behavior remains bounded and does not bypass authentication or ownership checks.

## Out of Scope

- Marketplace-wide BI analytics warehouse work.
- Real-time streaming dashboards beyond existing app capabilities.

## Verification Goal

- Add focused tests for new dashboard insight responses and shop-scoped authorization.
- Add focused tests for cache key isolation and invalidation paths impacted by shop/review mutations.
- Run `bunx tsc --noEmit`.
