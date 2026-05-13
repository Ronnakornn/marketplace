# Payment Domain

The Payment domain owns payment intents, provider webhooks, payment status, and payment-related order transitions.

## Responsibilities

- Payment intent/session creation
- Payment records
- Payment webhook verification
- Provider event idempotency
- Payment status updates
- Stock commit/release orchestration
- Refund provider handoff

## Business Rules

- Browser redirect is never proof of payment success.
- Payment success must come from verified provider webhook.
- Webhooks must be idempotent by provider event id.
- Successful payment marks payment succeeded, marks order paid, commits reserved stock, and creates shipments by shop.
- Failed or canceled payment releases reserved stock.
- Client cannot update payment status directly.

## Statuses

- Requires action
- Pending
- Succeeded
- Failed
- Canceled
- Refunded

## API Surface

- `POST /api/payments/:orderId/intent`
- `POST /api/payments/webhook`
- `GET /api/orders/:orderId/payment-status`
- `POST /api/refunds/:refundId/process`

## Frontend Surfaces

- Checkout payment method
- Payment return pending/result
- Order detail payment status
- Admin order monitoring

## Edge Cases

- Duplicate webhook.
- Invalid webhook signature.
- Buyer returns before webhook arrives.
- Payment failed after stock reservation.
- Payment succeeded after browser tab closed.
- Provider refund pending.

## Acceptance Criteria

- UI shows pending after payment redirect until backend status changes.
- Payment success is only set by webhook flow.
- Duplicate provider events do not double-commit stock or duplicate shipments.
