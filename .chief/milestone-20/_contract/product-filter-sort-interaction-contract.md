# Product Filter Sort Interaction Contract

## Contract

Mobile buyers must be able to open, understand, apply, revise, and clear existing Product Listing/Search filters and sort controls.

## Requirements

- Filter/sort entry point must be clear and reachable on mobile.
- Sheet content must group existing controls in a predictable hierarchy.
- Active filter chips must show the current filtered state clearly.
- Each active chip must remain removable where existing URL query behavior supports it.
- Clear filters action must preserve search query when existing behavior already preserves it.
- Disabled or unavailable facet states must stay visually distinct.

## Non-Goals

- Do not add new filter fields.
- Do not change how filters are encoded in URLs.
- Do not persist filter preferences.
- Do not introduce new API calls.

## Acceptance

- Mobile layout has no incoherent overlap or clipped labels in filter/sort UI.
- Active chips and clear action work with existing query-state behavior.
- Tests cover the main filter/sort/chip states touched by this milestone.
