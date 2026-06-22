# Task 3: Filterable Spec Validation for Public Listing

## Goal

Constrain public `attributeFilters` to active filterable specs in category-scoped product listing/search flows.

## Affected Areas

- `server/modules/catalog/catalog.service.ts`
- `server/modules/catalog/catalog.routes.ts`
- `server/modules/catalog/catalog.repository.ts` only if query shape needs minor adjustment
- `server/modules/catalog/catalog.service.test.ts`
- `server/modules/catalog/catalog.routes.test.ts`
- Buyer product listing tests if existing coverage depends on arbitrary filters

## Required Work

1. Validate `attributeFilters` only when a category scope is available.
2. Reject attribute filters without category scope if the endpoint cannot infer category context.
3. Load active specs for the scoped category.
4. Permit only specs with `isFilterable=true`.
5. Reject unknown, inactive, wrong-category, or non-filterable filter keys with `PRODUCT_SPEC_FILTER_INVALID`.
6. Keep existing valid product attribute filtering behavior after validation.
7. Preserve all non-attribute filters: price, brand, rating, stock, free shipping, promotions, sorting, and pagination.

## Out of Scope

- Faceted counts.
- Dynamic filter option discovery.
- Cross-category filters.
- Search relevance changes.

## Acceptance Criteria

- Valid filterable spec filters work.
- Invalid filters return `400`.
- Existing listing/search tests continue to pass.
- Tests cover at least one invalid key and one non-filterable key.

## Verification

```bash
bunx vitest run server/modules/catalog/catalog.service.test.ts server/modules/catalog/catalog.routes.test.ts app/features/product/components/ProductBuyerStates.test.tsx
```
