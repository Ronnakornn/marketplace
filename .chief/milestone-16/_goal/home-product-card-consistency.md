# Home Product Card Consistency

## Goal

Align product rails on the buyer home page with the reusable buyer `ProductCard` behavior from listing/search.

## In Scope

- Use reusable `ProductCard` for Recommended, New arrivals, and Recently viewed rails where data supports it.
- Preserve home-specific Flash Sale cards when sale urgency/progress UI is needed.
- Align quick-add, favorite, navigation tracking, cart handoff, disabled states, and accessible labels with listing/search.
- Normalize home product data into the shape needed by reusable product cards.

## Out of Scope

- Replacing all marketplace home visuals with generic cards.
- Reworking product detail pages.
- Rewriting seller storefront cards.

## Constraints

- Flash Sale may remain custom if it needs sale-specific progress and urgency UI.
- Card dimensions must remain stable in grids and rails.
- Quick-add must only appear when product/variant data is unambiguous.
