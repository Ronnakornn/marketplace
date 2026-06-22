# Metadata Driven Filter UI Contract

## Affected Frontend

- Search/category listing filter sidebar.
- Mobile filter sheet.
- Active filter chips.
- Empty state actions.

## Required Behavior

- Category filters display backend facet counts when available.
- Brand filters display backend facet counts when available.
- Price controls are initialized from backend price range metadata when user has not entered explicit min/max.
- Unavailable facet options are disabled or visually de-emphasized.
- Active filters remain removable via chips.
- Clear filters action removes filter query params while preserving the search query where appropriate.
- Mobile sheet and desktop sidebar expose equivalent filter options.

## Error and Empty States

- If facet metadata fails but products load, product results remain usable.
- If product results are empty, empty state offers at least one useful next action:
  - clear filters
  - try another keyword
  - browse an available category facet

## Constraints

- Do not add product spec/attribute filter UI in this milestone.
- Do not trust client-side filtering for result counts.
- Do not introduce business logic into shared UI primitives.
