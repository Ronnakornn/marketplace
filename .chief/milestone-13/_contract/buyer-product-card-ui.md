# Buyer Product Card UI Contract

## Scope

Improve product card UX for buyer listing/search/home surfaces that use `ProductCard`.

## Affected Frontend

- `app/features/product/components/ProductCard.tsx`
- listing/search/home surfaces that render product cards
- product query normalizers where card data needs shaping

## Required UI

- Stable product image area with no layout shift.
- Two-line title with predictable height.
- Price/range display.
- Original price/discount badge where available.
- Rating and sold count.
- Shop name and location.
- Stock/unavailable badge.
- Favorite button with accessible label.
- Quick add button only when one in-stock purchasable variant is unambiguous.
- Clear fallback action to open detail when quick add is not safe.

## Interaction Rules

- Card click tracks product click using existing tracking.
- Favorite and quick add must stop propagation and must not navigate unexpectedly.
- Quick add must not appear for ambiguous variant products.
- Disabled controls must expose understandable labels or titles.

## Constraints

- Do not overhaul catalog search/filter backend in this milestone.
- Keep cards compact and scannable.
- Avoid nested cards and unstable dimensions.
- Cards must work in 2-column mobile grids and wider desktop grids.

## Tests

Required tests:

- Card renders price, rating, sold count, shop, and stock state.
- Quick add appears only for exactly one purchasable no-option variant.
- Favorite and quick add do not trigger card navigation.
- Card remains accessible with keyboard focus.
