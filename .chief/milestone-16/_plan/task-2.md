# task-2: Normalize Home Product Rail Data for Reusable Buyer ProductCard

## Objective

Render Recommended, New Arrivals, and Recently Viewed rails through the reusable buyer `ProductCard` wherever home data supports safe behavior.

## Primary Files

- `app/features/marketplace/components/MarketplaceHome.tsx`
- `app/features/marketplace/queries.ts`
- `app/features/product/components/ProductCard.tsx` only if a small reusable prop/context extension is required.
- `server/modules/discovery/` and `server/modules/recommendation/` only if API data must be extended.

## Implementation Notes

- Prefer frontend normalization at the marketplace feature boundary when current API fields are enough.
- Extend backend DTOs only for fields required by card behavior, such as variant stock/options or image/price metadata.
- Keep Eden-inferred response types; avoid manually duplicating backend response types.
- Use reusable `ProductCard` for home product rails instead of maintaining a second independent card implementation.
- Quick-add must be disabled or omitted when variant data is ambiguous.

## Acceptance Criteria

- Recommended, New Arrivals, and Recently Viewed rails share product-card interaction behavior with listing/search.
- Home-specific wrappers do not fork favorite, quick-add, login, or toast logic.
- Flash Sale remains separate.
- Client display data is not treated as pricing or stock authority.

## Verification

- Add/update tests proving home rails render reusable product cards and handle insufficient quick-add data safely.
- Typecheck must pass after any type/DTO changes.
