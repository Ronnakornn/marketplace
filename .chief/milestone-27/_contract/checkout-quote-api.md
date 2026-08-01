# Checkout Quote API Contract

## Scope

Defines the read-only server path used by the checkout screen to obtain the
amount payable before an Order exists. See `CONTEXT.md` for the definition of
Checkout Quote.

## Route Shape

- `POST /api/checkout/quote`

Buyer-authenticated, same actor rules as `POST /api/checkout`.

`POST` is used despite being read-only because the request carries a coupon
code and must not be cached by intermediaries.

## Request Contract

```
cartId:     string (uuid, required)
couponCode: string (optional, minLength 1)
```

No address, shipping method, or payment method. Shipping is flat and does not
depend on them in this milestone.

## Response Contract

Always `200` when the cart is valid and owned by the actor.

```
subtotal:      number   // minor units
discountTotal: number
shippingTotal: number
taxTotal:      number
grandTotal:    number
currency:      string
coupon:        CouponOutcome | null
```

`CouponOutcome` when `couponCode` was supplied:

```
{ code: string, applied: true }
{ code: string, applied: false, reason: string }
```

`coupon` is `null` when no `couponCode` was supplied.

`reason` carries the `PromotionServiceError` code, so the client can render a
localized message per failure kind.

## Server Resolution Rules

- The amount must come from the same `calculateTotals` used by
  `CheckoutService.createCheckout`. A second amount formula must not be
  introduced anywhere, on either side of the wire.
- Coupon validation must go through the existing
  `promotionService.validateCouponForsubtotal`.
- The cart must be validated as belonging to the authenticated buyer, using the
  same assertion `createCheckout` uses.

## Error Contract

A Quote fails only for reasons that are not about the coupon:

- `404 CART_NOT_FOUND` — cart does not exist
- `403 CHECKOUT_FORBIDDEN` — cart not owned by actor, or actor is not a buyer

An unusable coupon is **not** an error. It is reported through
`coupon.applied: false` with the amount computed as if no coupon were supplied.

This is a deliberate divergence from `POST /api/checkout`, which throws
`400 INVALID_COUPON`. Quoting is display; ordering is commitment.

## Writes

None. The endpoint must not open a write transaction, create an Order, reserve
inventory, or record a coupon redemption.

## Consistency Guarantee

For identical `cartId` and `couponCode`, and unchanged underlying state:

```
quoteCheckout(...).grandTotal === createCheckout(...).totalCents
```

This is the contract's central obligation and must be asserted by a test.

## Non-Goals

- Address-dependent or weight-dependent shipping.
- Persisting quotes or giving them an expiry.
- Guaranteeing the quoted amount will be honoured at order time.
