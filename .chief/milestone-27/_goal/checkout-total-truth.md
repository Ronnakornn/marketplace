# Goal: Checkout Total Truth

## Problem

The checkout summary displays `cart.subtotal` as the total
(`app/features/checkout/components/CheckoutPage.tsx:43`, rendered at `:122` and
`:134`). The server charges `subtotal - discountTotal + shippingTotal + taxTotal`
(`server/modules/checkout/checkout.service.ts:173`), where `shippingTotal` is a
flat `FLAT_SHIPPING_CENTS = 500`.

Consequences visible to buyers today:

- Shipping is missing from the displayed total. The buyer is quoted one amount
  and charged another.
- Coupon discount is missing from the displayed total. The coupon input at
  `CheckoutPage.tsx:95` produces no visible effect until the order is placed.

The root cause is that the amount is computed in two places by two different
formulas, in two different processes.

## Objective

The checkout screen must never display an amount that is not the amount that
will be charged.

Amounts are computed on the server only. The client renders what the server
returns and computes no money of its own.

## Success Criteria

- The displayed total equals the charged total for the same cart and coupon,
  with and without a coupon applied.
- Shipping and discount are visible as their own rows before the buyer commits.
- A coupon's effect is visible before the order is placed.
- When the amount is unknown, the buyer cannot commit.

## Non-Goals

- Changing the shipping or tax rules. Flat shipping and zero tax stay as they
  are.
- Unifying `paymentStatus` writes across the payment module and the expiry job.
- A shared Money representation across services.
- Moving `FLAT_SHIPPING_CENTS` to the client. This is explicitly forbidden — it
  would recreate the second formula that caused this defect.
