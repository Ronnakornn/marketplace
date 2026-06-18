# Product Analytics Metrics

## Goal

Expose a focused first set of product metrics that is useful for seller product decisions without overbuilding attribution.

## Required Metrics

- Product views.
- Add-to-cart events.
- Orders.
- Units sold.
- Revenue.
- Conversion rate.
- Top SKUs.
- Low-performing products.

## Metric Rules

- Views and add-to-cart counts come from backend event tracking introduced by this milestone.
- Orders, units sold, and revenue come from trusted order/payment data, not client-submitted analytics payloads.
- Conversion rate should be derived consistently from the available event and order data.
- Low-performing products should be based on clear, deterministic criteria documented in the backend service.

## Constraints

- Metrics should support product-level filtering and date range filtering.
- Metrics must avoid N+1 queries and unnecessary relation loading.
- Large result sets must be paginated or limited.
