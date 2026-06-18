# Product Card Quick Add Handoff Contract

## Affected Frontend

- `app/features/product/components/ProductCard.tsx`
- Listing/search surfaces that render reusable `ProductCard`.

## Required Behavior

- Quick add remains available only when exactly one in-stock no-option variant is unambiguous.
- Successful quick add:
  - invalidates/refetches buyer cart count
  - shows visible confirmation
  - does not navigate to product detail
  - does not trigger product card click tracking as navigation
- Failed quick add:
  - shows readable error message
  - preserves current listing scroll/context
- Ambiguous products:
  - keep detail fallback action instead of quick add
  - do not show misleading disabled cart controls

## Constraints

- Product card dimensions must remain stable during pending/success/error states.
- Favorite and quick-add controls must stop propagation.
- Do not add card-level mini cart summaries.
