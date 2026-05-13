# Frontend Page Specs

This document defines page-level acceptance criteria for the marketplace frontend.

## Buyer Home `/`

Required sections:
- sticky search header
- promo/voucher strip
- flash sale
- category grid
- recommended product feed
- mobile bottom navigation

Acceptance:
- Renders useful content for guests.
- Product feed supports loading, error, empty, and infinite-scroll states.
- Product cards show image, title, price, shop/free shipping signal, rating/sold count where available.

## Product Detail `/products/:productId`

Required sections:
- media carousel
- price/discount
- title/rating/sold count
- variant selector
- shipping info
- shop card
- reviews
- recommendations
- sticky Add to Cart / Buy Now bar

Acceptance:
- Variant is required before Add to Cart or Buy Now when product has variants.
- Out-of-stock state disables Buy Now.
- Sticky CTA does not cover content.

## Cart `/cart`

Required sections:
- shop-grouped cart items
- item quantity controls
- availability warnings
- voucher entry
- sticky selected total and checkout CTA

Acceptance:
- Items are grouped by shop.
- Checkout CTA enables only for valid selected items.
- Empty cart shows continue shopping CTA.

## Checkout `/checkout`

Required sections:
- address
- items grouped by shop
- shipping per shop
- coupons
- payment method
- totals
- reservation timer
- sticky Place Order CTA

Acceptance:
- Single-page mobile checkout.
- Backend validation errors appear before payment.
- Reservation failure returns buyer to fix cart or quantities.

## Payment Return `/payment/return`

Required sections:
- payment pending/result status
- order number
- next-step explanation
- sticky action

Acceptance:
- Shows pending until backend payment status changes.
- Does not mark success from redirect params.

## Order Detail `/orders/:orderId`

Required sections:
- order status
- payment status
- shipment cards by shop
- tracking timeline
- item snapshots
- review/return actions

Acceptance:
- Shows order-level and shipment-level status separately.
- Displays per-shop shipments.

## Seller Dashboard `/seller`

Required sections:
- KPI cards
- pending shipment alerts
- low stock alerts
- unread chat or promotion status

Acceptance:
- Seller sees only own shop data.
- Primary CTA routes to pending shipment processing.

## Seller Orders `/seller/orders`

Required sections:
- shipment status filters
- shipment list
- buyer/order summary
- primary Process action

Acceptance:
- Mobile uses shipment cards.
- Desktop can use table.
- Seller cannot access another shop shipment.

## Admin Dashboard `/admin`

Required sections:
- operational exception cards
- payment exceptions
- shipment delays
- refund escalations
- moderation summary

Acceptance:
- Admin-only.
- Prioritizes exceptions over decorative dashboard content.

## Admin Users `/admin/users`

Required sections:
- customer/system user segmented control
- search
- role/status filters
- user list

Acceptance:
- Customers and system users are separated.
- Role/status updates show loading and error states.
