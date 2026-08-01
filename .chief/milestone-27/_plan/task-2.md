# Task 2: Assert Quote and Checkout Agree

## Objective

Make "the displayed amount equals the charged amount" a statement the test suite
can falsify.

## Inputs

- Contract: `_contract/checkout-quote-api.md` — Consistency Guarantee
- Task 1 output

## Implementation Notes

Extend `server/modules/checkout/checkout.service.test.ts`. Reuse the existing
repository mocks and fixtures in that file; do not build a parallel harness.

Required cases:

1. **Agreement, no coupon** — call `quoteCheckout` and `createCheckout` with the
   same actor and input against the same fixture state, assert
   `quote.grandTotal === checkout.totalCents`.
2. **Agreement, valid coupon** — same, with a coupon the promotion service
   accepts.
3. **Shipping is included** — assert `quote.grandTotal` exceeds
   `quote.subtotal - quote.discountTotal`, and that `shippingTotal` is non-zero
   for a non-empty cart. This is the specific defect being fixed; assert it
   directly rather than relying on case 1 alone.
4. **Unusable coupon does not fail the quote** — the promotion service rejects
   the coupon; assert the call resolves, `coupon.applied === false`, `reason` is
   populated, and `discountTotal === 0`.
5. **The same coupon still fails order creation** — assert `createCheckout`
   throws `400 INVALID_COUPON` for that coupon. This pins the deliberate
   divergence between the two paths.
6. **Quoting writes nothing** — assert `createPendingOrder` and `transaction`
   were not called.
7. **Ownership** — quoting another buyer's cart is rejected with the same error
   `createCheckout` produces.

## Constraints

- Cases 1 and 2 must obtain both numbers from real calls in the same test. Do
  not assert against a hardcoded expected total — a hardcoded number would still
  pass if both paths drifted together.

## Verification

- `bun run test`
- `bunx tsc --noEmit`
