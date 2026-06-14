# Product Cart Handoff Scope

## Goal

Complete the buyer product lifecycle UX from product discovery/detail actions through a clear handoff into the cart, without redesigning cart or checkout.

## In Scope

- Add-to-cart success, pending, and error UX from product surfaces.
- Clear next action after add-to-cart succeeds.
- Cart count synchronization after successful add-to-cart.
- Product detail add-to-cart and buy-now entry points.
- Reusable product card quick-add entry points used by listing/search.

## Out of Scope

- Cart page redesign.
- Checkout redesign.
- Payment/order flow changes.
- Mini cart drawer.
- Post-purchase review entry.
- Marketplace home quick-add unless it already uses the reusable `ProductCard`.

## Constraints

- Cart mutations must continue using existing trusted backend cart APIs.
- Product surfaces must not trust client-provided pricing or stock.
- Product UX must stop at handoff into cart or cart route.
- Business logic must stay out of shared UI primitives.
