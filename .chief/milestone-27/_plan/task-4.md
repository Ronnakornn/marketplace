# Task 4: Cover the Checkout Screen's Guard and Coupon Behaviour

## Objective

Pin the two screen behaviours that the service-level tests cannot see.

## Inputs

- Task 3 output
- Existing `app/features/checkout/components/CheckoutPage.test.tsx`

## Implementation Notes

Extend `CheckoutPage.test.tsx`, following the mocking style already in that
file.

Required cases:

1. **Commit guard, quote loading** — the place-order button is disabled and no
   amount is presented as final.
2. **Commit guard, quote failed** — the button is disabled, an error affordance
   is shown, and retrying refetches.
3. **No fallback amount** — when the quote fails, `cart.subtotal` is not
   displayed as the total. Assert its absence explicitly; this is the defect
   being prevented from returning.
4. **Applied coupon is what gets sent** — type a code, apply it, type a
   *different* code without applying, place the order; assert `createCheckout`
   received the applied code, not the typed one.
5. **Breakdown is rendered from the quote** — discount and shipping rows show
   the values from the quote response.
6. **Unusable coupon is not a screen error** — with `coupon.applied: false`, the
   summary still renders and the place-order button stays enabled.

## Constraints

- These tests assert screen behaviour only. Do not assert amount correctness
  here — a mocked quote value proves nothing about what the server would charge.
  That obligation belongs to task-2.

## Verification

- `bun run test`
- `bunx tsc --noEmit`
