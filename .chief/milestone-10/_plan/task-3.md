# Task 3: Product Detail Reviews UI

## Goal

Render real product reviews and rating summary on buyer product detail pages.

## Inputs

- Goals:
  - `_goal/product-detail-reviews.md`
  - `_goal/product-review-media.md`
- Contracts:
  - `_contract/product-detail-review-ui.md`
  - `_contract/review-media-api.md`

## Required Work

- Add product query helpers/hooks for:
  - `GET /api/products/:productId/reviews`
  - `GET /api/products/:productId/rating-summary`
- Update `ProductDetailPage` review section to render:
  - rating summary
  - distribution when data exists
  - review cards with reviewer name, rating, comment, media, date, and item snapshot
  - loading, empty, and error states
- Keep existing variant picker, stock, quantity, add-to-cart, and buy-now behavior unchanged.
- Render only media URLs returned by the review API.

## Verification

- Update `app/features/product/components/ProductBuyerStates.test.tsx` or add focused tests.
- Run:

```bash
bun run test app/features/product/components/ProductBuyerStates.test.tsx
bun run test app/features/product/queries.test.ts
bunx tsc --noEmit
```

## Out Of Scope

- Admin review moderation.
- Review creation UI on product detail.
- Backend changes beyond consuming approved review APIs.
