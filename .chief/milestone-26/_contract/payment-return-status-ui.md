# Payment Return Status UI Contract

## Scope

Defines buyer payment return behavior after checkout handoff and mock payment actions.

## Route Shape

The existing buyer return page remains:

- `/{locale}/payment/return?orderId={orderId}`

The page must read order/payment state from server-backed order data.

## Polling Rules

- When payment status is `pending` or `requires_action`, the page must poll automatically.
- Poll interval should be approximately every 2 seconds.
- Polling must stop once a terminal state is reached:
  - `succeeded`
  - `failed`
  - `canceled`
  - `refunded`
- Polling must also stop after a bounded wait window of roughly 30 to 60 seconds.

## Status Presentation

The page must render distinct buyer-readable states for:

- waiting for payment confirmation
- payment confirmed
- payment not completed
- payment refunded

The page may source raw payment status from the order API, but buyer-facing copy should explain the state in plain language.

## CTA Rules

- Success state must provide navigation to order detail.
- Failed or canceled state must not offer unsupported retry-from-order behavior in this milestone.
- The page may provide navigation back to orders, cart, or shopping surfaces.

## Consistency Rules

- Order detail and payment return must not contradict each other for the same order/payment state.
- Browser arrival on the return page alone must never flip payment to success.

## Verification Rules

- Frontend tests should cover pending polling behavior and terminal-state stop behavior.
- Manual verification should confirm that redirecting to the return page without a processed event leaves the page in a pending state until the server state changes.

