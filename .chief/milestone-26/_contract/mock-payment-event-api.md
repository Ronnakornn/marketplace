# Mock Payment Event API Contract

## Scope

Defines the server path used by the buyer mock payment page to trigger webhook-like payment events without trusting client state.

## Route Shape

Add an authenticated buyer-facing API endpoint:

- `POST /api/payments/mock/:paymentId/events`

The route must be protected with buyer authentication and must reject admin-only misuse.

## Request Contract

Request body must include:

- `eventType`
  - allowed values: `payment.paid`, `payment.failed`

Optional request metadata may be accepted for local traceability, but buyer-controlled fields must not replace server-owned payment facts.

## Server Resolution Rules

The endpoint must resolve the rest of the event from server state, not from buyer-submitted values:

- `paymentId` from route param
- owning `orderId` from the payment record
- `amount` from the payment record
- provider fixed to the mock provider contract already supported by `PaymentService`

The endpoint or delegated service must validate:

- the payment exists
- the payment belongs to an order owned by the authenticated buyer
- the payment is eligible for the requested transition
- duplicate events remain idempotent

## Processing Rules

- The endpoint must route through the existing webhook-like payment processor path or a shared service used by that path.
- The buyer request must not directly mark payment/order rows as paid or failed outside that processor.
- Existing side effects for success and failure must remain authoritative:
  - success: payment succeeded, order paid, shipment creation, downstream paid side effects
  - failure: payment failed, order canceled, reservation release

## Response Contract

The endpoint should return the same canonical outcome shape used by webhook processing:

- `ok: boolean`
- `code: string`

## Non-Goals

- Public unauthenticated mock event creation.
- Accepting arbitrary `orderId`, `amount`, or `providerRef` from the client as trusted values.
- Simulating retry, refund, or expired flows from the buyer page in this milestone.

