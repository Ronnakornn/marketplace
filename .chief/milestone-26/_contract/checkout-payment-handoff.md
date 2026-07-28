# Checkout Payment Handoff Contract

## Scope

Defines the buyer-visible checkout response and redirect handoff into the mock payment flow.

## Response Contract

`POST /api/checkout` must continue to return:

- `orderId: string`
- `orderNo: string`
- `paymentId: string`
- `paymentStatus: "pending"`
- `totalCents: number`

For this milestone it must also return:

- `paymentUrl: string`

## Payment URL Rules

- `paymentUrl` must be present for every successful checkout response created by the mock payment provider flow.
- `paymentUrl` must target the localized buyer payment page shape:
  - `/{locale}/payment/mock/{paymentId}`
- `locale` should use the checkout request locale when present.
- When the checkout request omits locale, the service may fall back to a stable default locale already used by the app.

## UX Rules

- Checkout UI should use the server-provided `paymentUrl` as the primary continuation path after order creation.
- The checkout surface must not synthesize payment success locally.
- The checkout surface may show a success message that the order was created, but payment remains pending until server status changes.

## Non-Goals

- Reusing a failed order for a second payment attempt.
- Returning provider-specific fields such as client secret or deep external redirect metadata.

