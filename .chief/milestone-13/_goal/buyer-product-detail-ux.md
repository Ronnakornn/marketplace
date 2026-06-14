# Buyer Product Detail UX

## Goal

Improve the buyer product detail experience so buyers can understand the product, trust the seller, choose options, and purchase with less friction.

## In Scope

- Product media gallery that makes images easier to inspect on mobile and desktop.
- Clear variant and quantity selection states.
- Prominent price, promotion, stock, and seller/shop context.
- Trust signals such as rating, sold count, shop identity, return hints, and shipping hints when data is available.
- Improved mobile sticky purchase bar for add-to-cart and buy-now decisions.
- Loading, unavailable, empty, and error states for buyer product detail.

## Out of Scope

- Checkout/cart redesign.
- Review and Q&A implementation already planned in milestone 10.
- Content moderation already planned in milestone 11.
- Seller analytics already planned in milestone 12.
- New recommendation engine.

## Constraints

- Product detail must keep same-origin `/api/*` requests and existing buyer routing.
- Business logic must stay out of shared UI components.
- Pricing and stock shown to the buyer must come from trusted backend data.
