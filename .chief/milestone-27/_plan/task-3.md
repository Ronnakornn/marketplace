# Task 3: Render Server-Quoted Amounts on Checkout

## Objective

The checkout screen shows the server's amount, broken down, and refuses to let
the buyer commit when that amount is unknown.

## Inputs

- Goal: `_goal/checkout-total-truth.md`
- Contract: `_contract/checkout-quote-api.md`
- Task 1 output

## Scope

`app/features/checkout/components/CheckoutPage.tsx`, plus i18n dictionaries.

## Implementation Notes

- Delete `const total = useMemo(() => cartQuery.data?.subtotal ?? 0, ...)` at
  `CheckoutPage.tsx:43`. Nothing on this screen may compute an amount.
- Add a quote query keyed on `["checkout-quote", cartId, appliedCoupon, locale]`.
  It refetches when the applied coupon changes and when the cart changes.
- Hold two pieces of coupon state: the input value, and the **applied** code.
  They are different things.
  - Add an apply action next to the coupon input at `CheckoutPage.tsx:95`.
  - Pressing it sets the applied code, which is what the quote is keyed on.
  - `createCheckout` must send the **applied** code, never the raw input value.
    A code typed but not applied must not reach order creation — otherwise the
    buyer is charged an amount they were never shown.
  - Provide a way to clear an applied coupon.
- Summary rows, in order: per-shop subtotals (existing), discount (only when
  non-zero), shipping, total. Render every amount from the quote response.
- Coupon feedback: when `coupon.applied === false`, show a localized message
  derived from `reason`. This is a message next to the coupon field, not an
  error state for the screen.
- Commit guard — the place-order button is disabled when the quote is loading,
  erroring, or absent. The two total displays (`:122` and `:134`) show a
  skeleton while loading and an error affordance with retry on failure. There is
  no fallback to `cart.subtotal`; that path must not exist.
- i18n: add every new key to both `th` and `en`. No hardcoded user-facing
  strings.
- Money rendering keeps using the existing `formatMoney` from
  `#/features/buyer/api`.

## Constraints

- No arithmetic on amounts anywhere in this file.
- `FLAT_SHIPPING_CENTS` or any equivalent constant must not appear in client
  code.

## Verification

- `bunx tsc --noEmit`
- `bun run test`
- Existing `CheckoutPage.test.tsx` must pass or be updated deliberately — the
  existing assertion that the server-provided `paymentUrl` is used must survive.
