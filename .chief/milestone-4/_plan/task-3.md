# Task 3: Catalog SKU Matrix, Publish Readiness, Media, and Moderation APIs

## Goal

Extend catalog APIs and services to support SKU option matrix management, category spec validation, media ordering, and product moderation lifecycle.

## Affected Areas

- `server/modules/catalog/**`
- `server/modules/admin/**` if existing admin product APIs are reused
- `server/modules/audit-log/**` or moderation integration if needed
- `server/context/app-context.ts`
- `server/index.ts`
- tests for catalog service/routes

## Required Work

1. Add catalog repository/service support for product options and option values.
2. Add seller option matrix endpoint:
   - `PUT /api/seller/products/:productId/options`
3. Extend variant create/update responses to include selected option values.
4. Validate duplicate SKUs and duplicate option combinations.
5. Add seller product detail endpoint if missing:
   - `GET /api/seller/products/:productId`
6. Add submit-for-review endpoint:
   - `POST /api/seller/products/:productId/submit-review`
7. Update publish readiness:
   - active category
   - required category specs
   - primary image
   - active priced variant
   - valid SKU option matrix
8. Add media ordering endpoint:
   - `PUT /api/seller/products/:productId/images/order`
9. Add admin moderation endpoints:
   - `GET /api/admin/catalog/products/moderation`
   - `PATCH /api/admin/catalog/products/:productId/approve`
   - `PATCH /api/admin/catalog/products/:productId/reject`
   - `PATCH /api/admin/catalog/products/:productId/suspend`
   - `PATCH /api/admin/catalog/products/:productId/restore`
10. Use existing `ModerationCase`/audit infrastructure when possible.

## Acceptance Criteria

- Public catalog only returns active products from active shops.
- Seller submit review only allows `DRAFT` or `REJECTED` products that pass readiness.
- Admin approve changes `PENDING_REVIEW` to `ACTIVE`.
- Admin reject and suspend require reasons.
- Seller can see rejection/moderation status in product detail.
- Product media maintains exactly one primary image when one is selected.
- Cache invalidation runs for product changes and status transitions.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Required focused tests:

- seller ownership guards
- publish readiness failures
- duplicate option combination rejection
- media order and primary image handling
- admin moderation status transitions
