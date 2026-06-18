# task-3: Implement seller product analytics backend APIs

## Objective

Add seller-only backend APIs that expose product analytics metrics, daily trend data, product performance, and SKU performance.

## Affected Areas

- `server/modules/product-analytics/**`
- `server/index.ts`
- `server/context/app-context.ts`
- Prisma repository queries
- backend tests

## Required Endpoints

```txt
GET /api/seller/analytics/products/summary
GET /api/seller/analytics/products/daily
GET /api/seller/analytics/products
GET /api/seller/analytics/products/skus
```

## Query Support

- `range`: `7d | 30d | 90d | custom`
- `from?`
- `to?`
- `productId?`
- `q?` for product table
- `sort?`
- `page?`
- `limit?`

## Requirements

- Require seller role with auth macros.
- Scope every query to the actor's active shop.
- Compute:
  - views
  - add-to-cart
  - orders
  - units sold
  - revenue
  - conversion rate
  - top SKUs
  - low-performing products
- Use trusted order/order-item/payment data for orders, units sold, and revenue.
- Return zero-value summary for empty data.
- Paginate product and SKU tables.
- Avoid N+1 queries.

## Implementation Notes

- Put metric logic in service code.
- Put Prisma access in repository code.
- Define deterministic low-performing product criteria in the service.
- Keep date handling explicit and testable.
- If multi-currency data is possible, document or constrain first-release currency behavior.

## Required Tests

- Seller can read own shop analytics.
- Seller cannot read another seller's product analytics.
- Date range filters apply correctly.
- Empty analytics returns zero values.
- Revenue is derived from trusted order data.
- Pagination and sorting work for product/SKU tables.

## Completion Criteria

- All four endpoints return typed, validated responses.
- Seller isolation is tested.
- API is mounted from `server/index.ts`.
