# Payment Status Trust

## Goal

Preserve the marketplace payment invariant: browser redirects and buyer clicks must never directly mark a payment or order as successful.

## Requirements

- Payment success and failure must be processed through a webhook-like server path that reuses the existing payment transition and idempotency rules.
- Mock payment actions may trigger server-side mock provider events, but they must not directly update `Payment`, `Order`, inventory reservations, shipments, affiliate commissions, or notifications from client-trusted state.
- Payment amount, order ownership, payment ownership, and terminal-state transitions must be validated server-side before processing a mock event.
- Duplicate mock events must be idempotent.
- Paid orders must continue to use the existing side effects for successful payment, including reservation commit behavior and shipment creation.
- Failed or expired payments must continue to release active reservations and cancel the order according to existing payment rules.

## Success Criteria

- A buyer can complete a checkout, visit the mock payment page, simulate paid or failed, and land on payment return with status derived from server data.
- A forged or mismatched mock event cannot update another buyer's payment.
- A repeated success/failure event returns an idempotent response instead of corrupting state.

