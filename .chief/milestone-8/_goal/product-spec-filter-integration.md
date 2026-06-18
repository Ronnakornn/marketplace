# Goal: Product Spec Filter Integration

## Outcome

Buyer-facing product listing and search filters use active filterable category specs instead of accepting arbitrary product attribute keys.

## Scope

- Validate public `attributeFilters` against active category specs where `isFilterable=true`.
- Reject unknown, inactive, non-filterable, or wrong-category attribute filter keys with `400`.
- Keep filter behavior API-first and backend-controlled.
- Preserve existing product listing/search pagination, sorting, price, rating, stock, and promotion filters.

## Out of Scope

- Faceted count aggregation.
- Dynamic generated filter widgets for every category.
- Search relevance scoring changes.
- Cross-category filter inference.

## Success Criteria

- Public category/search endpoints reject invalid spec filters.
- Valid filterable specs continue filtering products by stored product attributes.
- Existing non-attribute filters continue to work.
- Route/service tests cover valid and invalid filter cases.
