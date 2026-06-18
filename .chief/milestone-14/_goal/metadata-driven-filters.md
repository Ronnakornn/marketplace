# Metadata Driven Filters

## Goal

Make first-pass buyer filters metadata-driven so category, brand, and price controls reflect available results instead of relying only on static client options.

## In Scope

- Category facet metadata.
- Brand facet metadata.
- Price range metadata.
- Filter option counts when available.
- Disabled or visually de-emphasized unavailable filter options.
- Active filter chips and reset behavior that remain consistent with URL query state.

## Out of Scope

- Product spec/attribute facets.
- Rating, stock, shipping, and promotion facets unless already available with no new contract work.
- Advanced price slider polish beyond a usable price range control.

## Constraints

- Filter metadata must be derived from trusted backend data.
- Filters must remain functionally equivalent on mobile sheet and desktop sidebar.
- Empty states must offer useful next actions such as clearing filters or changing query.
