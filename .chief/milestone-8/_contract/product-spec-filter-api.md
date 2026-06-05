# Contract: Product Spec Filter API

## Applies To

Public listing/search endpoints that accept `attributeFilters`:

- `GET /api/products`
- `GET /api/products/search`
- `GET /api/categories/:categoryId/products`
- Existing public shop/product-list endpoints when they pass category-scoped attribute filters.

## Filter Format

Existing `attributeFilters` string format remains supported:

```txt
color:black,size:m
```

Each pair is interpreted as:

- key: normalized category spec `attributeKey`
- value: requested attribute value

## Validation Rules

- Attribute filters are accepted only when a `categoryId` is available in the request scope.
- Each filter key must match an active category spec for that category.
- Each matched spec must have `isFilterable=true`.
- Unknown, inactive, wrong-category, or non-filterable keys return `400`.
- Valid filters continue using existing product attribute filtering semantics.

## Error Contract

Invalid filters return `400` with code:

- `PRODUCT_SPEC_FILTER_INVALID`

## Out of Scope

- Faceted counts.
- Dynamic filter option discovery.
- Cross-category attribute filtering.
- Search ranking changes.
