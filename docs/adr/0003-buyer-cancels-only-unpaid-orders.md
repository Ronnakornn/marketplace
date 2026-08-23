# Buyer cancels only unpaid orders

## Status

Accepted

## Decision

Buyer cancellation applies to the entire order only while its payment is
pending or requires action. It releases inventory reservations and any coupon
reservation, then marks the payment, checkout, order, and shop orders
cancelled. Cart items are not restored.

Paid, packed, shipped, or delivered orders use the existing return/refund flow.

## Consequences

Multi-shop orders stay atomic at cancellation time. The same reservation
release path used by expired payments is reused, preventing stock leaks.
