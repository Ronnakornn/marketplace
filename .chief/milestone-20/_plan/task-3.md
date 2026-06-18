# Task 3: Polish Active Chips and Listing Header

## Objective

Make active filters and listing context easier to scan and revise on Product Listing/Search.

## Scope

- Improve active filter chip labels and layout.
- Preserve removable chip behavior.
- Preserve clear filters behavior, including preserving the search query where current behavior already does so.
- Improve responsive listing/search header readability around result count, sort state, and current query/category context.

## Likely Files

- `app/features/product/components/ProductListingPage.tsx`
- Translation or test fixture strings only if existing UI copy changes require them.

## Constraints

- Do not change query-state behavior.
- Do not add persistent preferences.
- Keep mobile-first hierarchy, with desktop as a responsive adaptation.

## Verification

- Active chips are readable and removable on mobile.
- Header text does not overlap or clip on mobile and desktop.
- Existing listing/search states remain represented.
