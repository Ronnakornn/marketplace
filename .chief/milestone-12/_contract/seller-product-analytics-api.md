# Seller Product Analytics API Contract

## Scope

Expose seller-only product analytics APIs for the seller product analytics page.

## Module

Preferred backend module:

```txt
server/modules/product-analytics/
```

The module should follow the repository's DDD rules:

- `repositories/` or repository file owns Prisma access.
- `services/` or service file owns metric logic.
- `controllers/` or routes file owns HTTP concerns.
- validators use TypeBox or generated schema composition where practical.

## Authentication

All endpoints must require seller access:

```ts
{ withRole: 'SELLER' }
```

Seller access must be scoped to the actor's active shop. Sellers must not read another seller's product analytics.

## Endpoints

### Summary

```txt
GET /api/seller/analytics/products/summary
```

Query:

- `range`: `7d | 30d | 90d | custom`
- `from?`: ISO date for custom range
- `to?`: ISO date for custom range
- `productId?`

Response:

- `views`
- `addToCart`
- `orders`
- `unitsSold`
- `revenue`
- `conversionRate`
- `currency`

### Daily Series

```txt
GET /api/seller/analytics/products/daily
```

Query:

- same date range query as summary
- `productId?`

Response:

- `items[]` with `date`, `views`, `addToCart`, `orders`, `unitsSold`, `revenue`, `conversionRate`

### Product Table

```txt
GET /api/seller/analytics/products
```

Query:

- same date range query as summary
- `q?`
- `sort?`
- `page?`
- `limit?`

Response:

- `items[]` with product identity, cover image, status, views, addToCart, orders, unitsSold, revenue, conversionRate
- `pagination`

### SKU Table

```txt
GET /api/seller/analytics/products/skus
```

Query:

- same date range query as summary
- `productId?`
- `sort?`
- `page?`
- `limit?`

Response:

- `items[]` with product identity, variant identity, SKU/options, views when attributable, addToCart, orders, unitsSold, revenue
- `pagination`

## Metric Rules

- Use daily aggregation for the requested date range.
- Derive conversion rate consistently as orders divided by views unless implementation documents a better first-release rule.
- Return zero values for products with no activity instead of omitting owned products from table views.
- Limit or paginate large result sets.

## Tests

Required tests:

- Seller can read analytics for their own shop.
- Seller cannot read analytics for another seller's products.
- Date range filters are applied.
- Summary, daily series, product table, and SKU table calculate trusted order revenue.
- Empty analytics returns zero-value summaries.
