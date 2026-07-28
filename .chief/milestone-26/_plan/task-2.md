# Task 2: Authenticated Mock Payment Event API

## Objective

Add a buyer-authenticated API endpoint that triggers mock provider payment events through existing payment transition rules.

## Inputs

- Goals:
  - `_goal/payment-status-trust.md`
  - `_goal/payment-verification.md`
- Contracts:
  - `_contract/mock-payment-event-api.md`

## Route

- `POST /api/payments/mock/:paymentId/events`

## Request Body

- `eventType`: one of `payment.paid`, `payment.failed`

## Implementation Notes

- Protect the route with auth.
- Reject non-buyer/admin misuse consistently with nearby buyer-only APIs.
- Resolve trusted event facts from server data:
  - payment id from route
  - order id from payment record
  - amount from payment record
  - provider as `mock`
- Validate the payment belongs to the authenticated buyer's order.
- Generate a stable idempotency/provider reference for the mock event.
- Reuse `PaymentService.handleWebhook()` or a shared internal method that preserves the same transition and idempotency behavior.
- Do not accept trusted `orderId`, `amount`, `provider`, or terminal payment status from client input.

## Verification

- Backend tests must cover success, failure, duplicate event idempotency, forbidden cross-buyer access, and invalid terminal transitions.
- Existing webhook tests must still pass.

