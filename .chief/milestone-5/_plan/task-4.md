# Task 4: Buyer Product Detail Transaction UX

## Goal

Upgrade buyer product detail so buyers can inspect media, select a valid SKU, choose quantity, and take cart/buy actions safely.

## Dependencies

- Milestone 4 public product detail response includes ordered media, video, variant option values, specs, and availability.
- Existing buyer cart, favorite, follow, and chat APIs.

## Affected Areas

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductCard.tsx`
- `app/features/product/queries.ts`
- buyer product tests

## Required Work

1. Add interactive gallery with selected image preview and thumbnails.
2. Add video slot/tab when product video exists.
3. Add option-based variant picker for up to two axes.
4. Disable out-of-stock option values where determinable.
5. Add selected variant summary.
6. Update price and stock from selected variant.
7. Add quantity stepper constrained by selected variant stock.
8. Require selected variant before add-to-cart or buy-now.
9. Keep sticky mobile CTA usable and visually stable.
10. Show specs table, shop card, chat/follow actions, highlights, description, reviews preview, and related products.
11. Update product card only as needed for primary image, price range, or stock state compatibility.

## Acceptance Criteria

- Buyer cannot add to cart without required variant selection.
- Buyer cannot select quantity above available stock.
- Out-of-stock product disables purchase CTAs.
- Gallery, video, specs, shop card, and sticky CTA render on mobile and desktop without overlap.
- Existing favorite, follow, chat, and cart behavior still works.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- buyer product detail desktop
- buyer product detail mobile
- out-of-stock state
- variant-required state
