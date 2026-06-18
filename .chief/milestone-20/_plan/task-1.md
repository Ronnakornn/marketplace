# Task 1: Audit Product Listing Search Mobile UX

## Objective

Audit the current buyer Product Listing/Search mobile filter, sort, and active chip UX before making changes.

## Scope

- Inspect existing `ProductListingPage` and related buyer product tests.
- Identify mobile pain points in filter/sort entry, sheet hierarchy, active chips, and listing header readability.
- Save findings under `.chief/milestone-20/_report/product-listing-ux-audit.md`.

## Likely Files

- `app/features/product/components/ProductListingPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- `app/features/product/components/ProductCard.tsx` only for context, not primary edit scope.

## Constraints

- Do not change backend/API behavior.
- Do not implement during audit unless a tiny no-risk copy or structure issue blocks assessment.
- Keep findings tied to existing UI and tests.

## Verification

- Audit report lists concrete issues and chosen polish targets.
- Audit confirms no backend/API changes are required.
