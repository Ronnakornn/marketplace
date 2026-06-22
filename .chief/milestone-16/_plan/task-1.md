# task-1: Complete Home Composition, Responsive Layout, and Resilient States

## Objective

Make the buyer home page feel complete and stable across desktop and mobile before changing product-card behavior.

## Primary Files

- `app/features/marketplace/components/MarketplaceHome.tsx`
- `app/features/marketplace/components/MarketplaceHome.test.tsx`
- Supporting home-only components under `app/features/marketplace/` if extraction is useful.

## Implementation Notes

- Keep orchestration in `app/features/marketplace/`.
- Refine the existing hero, voucher strip, category grid, featured shops, sticky CTA, and mobile bottom nav rather than introducing a separate home system.
- Add layout-stable loading and empty states for sections that can be missing data.
- Keep empty optional sections hidden or convert them into useful browse actions.
- Preserve same-origin frontend API behavior.

## Acceptance Criteria

- Hero, voucher strip, categories, featured shops, sticky CTA, and mobile bottom nav are present where data/state allows.
- Home query loading, error, retry, and empty data paths are understandable.
- Desktop and mobile layouts have no obvious text overlap, clipped controls, or unstable fixed-format elements.
- No cart, checkout, payment, seller, or admin behavior is redesigned.

## Verification

- Update focused marketplace home tests for loading, empty, and error/retry behavior.
- Include browser evidence later in task-5.
