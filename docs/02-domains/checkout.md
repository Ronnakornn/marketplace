# Checkout Domain

The Checkout domain owns checkout drafts, trusted totals, stock reservation, and order placement.

## Responsibilities

- Checkout draft
- Address selection
- Shop-grouped item review
- Shipping method per shop
- Coupon application
- Trusted total calculation
- Inventory reservation
- Pending order creation
- Payment intent creation handoff

## Business Rules

- Checkout is single-page on mobile.
- Checkout items are grouped by shop.
- Backend recalculates all prices, discounts, shipping, and totals.
- Stock must be reserved before payment intent creation.
- Reservation has an expiry time.
- Expired or canceled checkout releases reserved stock.
- Checkout does not mark payment success.

## Statuses

- Open
- Reserved
- Payment pending
- Completed
- Expired
- Canceled

## API Surface

- `POST /api/checkout`
- `PATCH /api/checkout/:checkoutId`
- `POST /api/checkout/:checkoutId/reserve`
- `POST /api/checkout/:checkoutId/place-order`
- `POST /api/payments/:orderId/intent`

## Frontend Surfaces

- Checkout page
- Address selector
- Shipping method selector
- Coupon selector
- Checkout summary
- Reservation timer
- Sticky Place Order CTA

## Edge Cases

- Missing address.
- Shipping unavailable for one shop.
- Coupon not applicable.
- Stock reservation fails.
- Price changed since cart.
- Reservation expires before payment.

## Acceptance Criteria

- Checkout shows per-shop shipping.
- Checkout blocks payment when required data is missing.
- Reservation failures show item-level errors.
- Pending order is created only after successful reservation.
