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
- Checkout totals must be recalculated after coupon changes.
- Coupon redemption should be recorded when order is finalized.

## API Surface

- `GET /api/seller/promotions`
- Checkout coupon application through `PATCH /api/checkout/:checkoutId`

## Frontend Surfaces

- Home voucher strip
- Cart shop vouchers
- Checkout coupon selector
- Seller promotions

## Edge Cases

- Coupon expired.
- Minimum spend not met.
- Coupon shop mismatch.
- Coupon already redeemed.
- Coupon usage limit reached.

## Acceptance Criteria

- Ineligible coupons show a clear reason.
- Checkout totals use backend discount calculation.
