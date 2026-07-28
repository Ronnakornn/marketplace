# Buyer Payment UX

## Goal

Make the buyer payment handoff feel complete and trustworthy after checkout by adding a mock-provider payment page, explicit payment return states, and clear navigation back into the order journey.

## Scope

- Applies to buyer checkout, payment handoff, payment return, and order payment status surfaces.
- Checkout must return a usable `paymentUrl` for the pending payment created with the order.
- Buyer must be sent to a localized mock payment page at `/{locale}/payment/mock/[paymentId]`.
- The mock payment page must show enough order/payment context for the buyer to confirm the amount and order.
- The mock payment page must support simulated success and failure events for local/demo verification.
- The payment return page must read order/payment status from the server and present pending, success, failed, canceled, and refunded states clearly.
- Order list/detail surfaces should not contradict payment return status.

## Non-Goals

- Real provider integration such as Stripe, Omise, 2C2P, bank transfer, or wallet rails.
- Retry payment from an existing failed or canceled order.
- New coupon, shipping-rate, or checkout recalculation behavior.
- New refund, return, support, dispute, loyalty, or coin flows.
- Admin or seller payment operation UI.

