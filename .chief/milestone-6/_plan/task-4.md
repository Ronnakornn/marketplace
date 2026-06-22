# Task 4: Search, Category Listing, and Product Card Merchandising

## Goal

Upgrade search/category listing and product cards so buyers can filter, sort, compare cards, and take safe quick actions.

## Affected Areas

- `app/features/product/components/ProductListingPage.tsx`
- `app/features/product/components/ProductCard.tsx`
- `app/features/product/queries.ts`
- category/search route files
- frontend tests

## Required Work

1. Add or refine search/category listing filters:
   - category tree/breadcrumb
   - brand
   - price range
   - rating
   - category specs/attributes
   - in-stock
   - shipping/promo badges where data exists
2. Reflect active filters in URL query state.
3. Add removable active filter chips.
4. Add mobile filter sheet and desktop filter sidebar.
5. Support sort options:
   - relevance
   - newest
   - price low/high
   - top sales
   - rating
6. Add recent searches and popular/suggested searches.
7. Improve empty states with clear next actions.
8. Update product card:
   - primary image
   - two-line title
   - price/range
   - promo/original price when available
   - rating/sold
   - shop/location
   - badges
   - favorite quick action
   - conditional quick add-to-cart
   - impression/click tracking

## Out of Scope

- Typo-tolerant search.
- Semantic search.
- Advanced personalized ranking.
- Comparison mode.
- Full quick-view modal.

## Acceptance Criteria

- Mobile and desktop filters are functionally equivalent.
- Product lists never request unbounded results.
- Quick add-to-cart is available only when there is exactly one unambiguous purchasable variant.
- Product cards remain layout-stable on mobile and desktop.
- Empty states suggest clear next actions.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- search desktop
- search mobile filter sheet
- category listing desktop
- product card grid mobile
