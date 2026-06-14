# Product Action Surface Consistency

## Goal

Make product detail and reusable product card add-to-cart actions behave consistently so buyers get the same feedback and recovery paths across product surfaces.

## In Scope

- `ProductDetailPage` add-to-cart and buy-now actions.
- `ProductCard` quick-add where the action is unambiguous.
- Listing/search surfaces that render reusable `ProductCard`.
- Shared product action behavior through feature-level helpers/hooks where useful.

## Out of Scope

- Home-specific card implementations that do not use `ProductCard`.
- Seller/admin product actions.
- Product comparison or wishlist redesign.

## Constraints

- Quick-add must still be hidden or replaced by detail navigation when variants are ambiguous.
- Actions must not accidentally navigate when buyer taps favorite or quick-add controls.
- Product cards must keep stable dimensions.
