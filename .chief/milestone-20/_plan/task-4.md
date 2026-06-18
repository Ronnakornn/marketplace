# Task 4: Update Focused Listing Search Tests

## Objective

Update or add focused tests for the intentional Product Listing/Search UX structure changes.

## Scope

- Cover filter/sort sheet entry and visible grouped controls.
- Cover active chip removal and clear filters behavior.
- Cover unavailable facet disabled presentation where touched.
- Keep existing ProductBuyerStates tests meaningful.

## Likely Files

- `app/features/product/components/ProductBuyerStates.test.tsx`
- Possibly `app/features/product/components/ProductCard.test.tsx` only if card layout is touched.

## Constraints

- Do not broaden tests into backend or API behavior.
- Do not rely on production data.
- Keep tests deterministic and focused.

## Verification

- Focused Product Listing/Search tests pass.
- Test assertions reflect buyer-visible behavior, not brittle implementation details.
