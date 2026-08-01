# Task 1: Checkout Quote Service and Route

## Objective

Expose the amount payable for a cart, read-only, computed by the same code that
computes the charged amount.

## Inputs

- Goal: `_goal/checkout-total-truth.md`
- Contract: `_contract/checkout-quote-api.md`
- Glossary: `CONTEXT.md` — Checkout Quote

## Route

- `POST /api/checkout/quote`

## Implementation Notes

- Add `CheckoutService.quoteCheckout(actor, data)` in
  `server/modules/checkout/checkout.service.ts`.
- Reuse `calculateTotals` unchanged. Do not copy it, do not fork it, do not
  inline the shipping constant anywhere else. Relax its visibility only as far
  as needed.
- `validateCouponForCheckout` already takes the repository as a parameter
  (`checkout.service.ts:186`) and `ICheckoutRepository` already extends
  `IPromotionValidationRepository` (`checkout.repository.ts:78`). Call it with
  `this.repo` directly — no transaction, and no change to the repository
  interface.
- Catch `CheckoutServiceError` with code `INVALID_COUPON` from that call and
  convert it to `coupon: { applied: false, reason }`, then compute the amount
  with zero discount. Do not let it propagate.
- Reuse the existing cart-ownership and actor assertions from `createCheckout`
  (`assertBuyer`, `assertCart`). Do not write new ones.
- Open no transaction. This path must not write.
- Add the route in `server/modules/checkout/checkout.routes.ts` with
  `withAuth: true`, a TypeBox body schema, and a response schema, matching the
  shape of the existing `POST /api/checkout` registration.
- Add the client function in `app/features/buyer/api.ts` alongside
  `createCheckout`. Do not wire it into any component in this task.

## Constraints

- `createCheckout` behaviour must not change. An unusable coupon must still
  throw `400 INVALID_COUPON` there.
- No amount arithmetic may be added outside `calculateTotals`.

## Verification

- `bunx tsc --noEmit`
- `bun run test`
- Existing checkout tests must still pass unchanged.
