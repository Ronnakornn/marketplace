# Promotion Domain

The Promotion domain owns coupons, vouchers, campaign pricing, and eligibility checks.

## Responsibilities

- Platform coupons
- Shop coupons
- Campaign pricing
- Coupon redemptions
- Eligibility checks
- Discount calculation inputs

## Business Rules

- Coupon eligibility is validated on the backend.
- Discount amounts use integer cents.
- Coupon application can be shop-level or platform-level.
- `FREE_SHIPPING` coupons waive shipping only; they never reduce product subtotal.
- A shop-scoped free-shipping coupon waives only that shop's shipment; a platform coupon waives every selected shop shipment.
- Checkout totals must be recalculated after coupon changes.
- Coupon redemption should be recorded when order is finalized.
- Flash-sale price and quota are resolved in the checkout transaction; browser-provided sale prices are ignored.
- Active flash-sale quota is reserved for the payment window, committed only after payment succeeds, and released on failure, cancellation, or expiry.
- One buyer coin equals THB 1. Coins discount product subtotal only, up to 20%; shipping is never discounted by coins.
- Paid orders earn 1% cashback after discounts. Coin spending is pending until payment succeeds and is restored when payment does not complete.

## API Surface

- `GET /api/seller/promotions`
- `GET|POST|PATCH /api/admin/flash-sales`
- `POST /api/admin/flash-sales/:flashSaleId/items`
- `PATCH|DELETE /api/admin/flash-sale-items/:itemId`
- `GET /api/seller/flash-sales`
- `POST /api/seller/flash-sales/:flashSaleId/items`
- `PATCH|DELETE /api/seller/flash-sale-items/:itemId`
- `GET /api/me/coins?limit={limit}&cursor={entryId}`
- Checkout pricing through `POST /api/checkout` and `POST /api/checkout/quote`

## Frontend Surfaces

- Home voucher strip
- Cart shop vouchers
- Checkout coupon selector
- Seller promotions
- Admin flash-sale campaign management
- Buyer coin wallet/history and checkout redemption

## Edge Cases

- Coupon expired.
- Minimum spend not met.
- Coupon shop mismatch.
- Coupon already redeemed.
- Coupon usage limit reached.
- A seller free-shipping coupon is applied to a multi-shop checkout: only the coupon owner's shipping fee is waived.
- Flash-sale quota is exhausted or a buyer exceeds the per-user cap while paying.
- Payment expires after coins or flash-sale quota were reserved.

## Acceptance Criteria

- Ineligible coupons show a clear reason.
- Checkout totals use backend discount calculation.
