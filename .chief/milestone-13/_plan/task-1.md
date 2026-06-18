# task-1: Shape buyer product detail and related/recently viewed APIs for UX-ready data

## Objective

Ensure buyer product UX has the backend data it needs for media, variants, trust signals, related products, and recently viewed products.

## Affected Areas

- `server/modules/catalog/**`
- `server/modules/tracking/**`
- `server/index.ts` if a new route is mounted
- `app/features/product/queries.ts`
- backend route/service tests

## Requirements

- Keep `GET /api/products/:productId` backward compatible.
- Ensure product detail includes:
  - ordered public media
  - public-safe video when available
  - variant matrix with option values
  - available stock derived from inventory
  - rating/sold count/shop/brand/trust signal fields where data exists
- Add or expose related products through:

```txt
GET /api/products/:productId/related
```

- Related products must:
  - exclude the current product
  - only return active products from active shops
  - prefer same category, then same shop/brand where practical
  - keep limit small and validated
- Recently viewed should reuse existing tracking behavior where possible and preserve user/session isolation.

## Implementation Notes

- Avoid schema changes unless strictly required.
- Avoid N+1 queries when loading product detail relations.
- Keep public listing/card response shape compatible with `normalizePublicProduct`.
- Use TypeBox validation for new route query params.

## Required Tests

- Product detail returns variant option matrix with stock.
- Product detail hides private/secret media URLs.
- Related products exclude the current product.
- Related products only include active products from active shops.
- Recently viewed respects user/session isolation if touched.

## Completion Criteria

- API data supports milestone-13 UI contracts.
- Existing product query normalizer tests pass.
- Catalog route tests cover related product behavior.
