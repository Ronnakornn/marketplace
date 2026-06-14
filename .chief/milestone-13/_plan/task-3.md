# task-3: Improve buyer product cards for listing/search/home surfaces

## Objective

Improve product cards so buyers can scan listing/search/home grids quickly and use safe quick actions.

## Affected Areas

- `app/features/product/components/ProductCard.tsx`
- buyer listing/search/home surfaces that render product cards
- `app/features/product/queries.ts`
- frontend tests

## Requirements

- Product card must show:
  - stable image area
  - title with predictable two-line height
  - price or price range
  - original price/discount when available
  - rating
  - sold count
  - shop name
  - shop location
  - stock/unavailable state
- Favorite button must have accessible name and must not trigger card navigation.
- Quick add must:
  - appear only for exactly one purchasable no-option variant
  - stop navigation propagation
  - invalidate buyer cart on success
  - avoid ambiguous variant products
- If quick add is unsafe, card should clearly lead buyer to product detail.

## Design Constraints

- Cards must be stable in two-column mobile grids.
- Cards must avoid layout shift when badges/actions load.
- Text must not overlap or overflow controls.
- Keep card styling compatible with marketplace buyer surfaces.

## Required Tests

- Renders core card metrics and shop context.
- Quick add only appears for exactly one safe variant.
- Favorite click does not navigate.
- Quick add click does not navigate.
- Out-of-stock card state is visible.

## Completion Criteria

- Existing listing/search/home screens still render product cards.
- Product card tests cover safe quick actions and responsive state assumptions.
