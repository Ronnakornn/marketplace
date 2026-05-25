# task-19: Migrate public buyer product discovery/detail UI to the shared product query layer

## Goal

Move public/buyer product reads from one-off `fetch()` helpers toward the shared product query layer and Eden-inferred types.

## Scope

- Migrate buyer/public product consumers including:
  - marketplace home
  - product listing/search/category pages
  - deals page
  - product detail and related products
  - shop product listing where applicable
- Include catalog list/detail/category/shop-products and search products in the public product discovery layer.
- Update product components that depend on old buyer product types only as needed.

## Implementation Notes

- Start with read-only product flows. Do not change cart, checkout, payment, order, or inventory reservation behavior.
- Preserve locale behavior and localized routes.
- Preserve product visibility/status rules by continuing to use public endpoints that expose active public products only.
- Preserve pagination and filter/sort behavior.
- If `app/features/buyer/api.ts` still contains non-product buyer APIs, do not refactor unrelated address/cart/order/profile APIs in this task.
- Keep existing product card/page layouts unless data-state handling requires a small adjustment.

## Verification

- Update affected product UI tests to mock the new query layer.
- Add or update focused tests for marketplace home, listing/search, deals, and product detail where practical.
- Run focused product UI tests touched by this task.
- Run `bunx tsc --noEmit`.
