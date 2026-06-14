# Buyer Listing Load More UI Contract

## Affected Frontend

- `app/features/product/components/ProductListingPage.tsx`
- `app/features/product/queries.ts`
- Buyer routes that render product listing/search/category pages.

## Required Behavior

- Initial page loads first page of results with API-backed metadata.
- Load more appends the next page of results.
- Product IDs already shown must not duplicate in the rendered grid.
- Load more button is visible only when `hasNextPage` is true.
- Next-page loading has an isolated pending state and must not replace already rendered products with a skeleton.
- Next-page failure shows retry affordance without losing current products.
- Changing query, category, brand, price, or sort resets accumulated results to page 1.

## Result Summary

Listing header must show:

- loading state before metadata is available
- exact `totalCount` when available
- visible count after load-more append
- active query/filter summary when filters exist

## Constraints

- No numbered pagination in this milestone.
- No automatic infinite scroll in this milestone.
- URL query state remains the source of truth for base query/filter/sort.
