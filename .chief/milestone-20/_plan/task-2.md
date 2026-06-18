# Task 2: Polish Mobile Filter Sort Sheet

## Objective

Improve the mobile-first filter/sort sheet so buyers can understand and apply existing controls quickly.

## Scope

- Improve filter/sort entry point clarity.
- Reorganize existing filter and sort controls inside the mobile sheet.
- Improve action placement for apply/clear behavior using existing URL/query mechanics.
- Improve disabled/unavailable facet presentation.

## Likely Files

- `app/features/product/components/ProductListingPage.tsx`
- Existing shared UI primitives only if required by current component patterns.

## Constraints

- Do not add new filter dimensions.
- Do not change URL query semantics.
- Do not introduce new API calls.
- Avoid nested card layouts and mobile text overflow.

## Verification

- Mobile sheet controls fit without incoherent overlap.
- Sort/filter actions still map to existing query behavior.
- Desktop layout remains usable.
