# Task 3: Buyer Mock Payment Page

## Objective

Build a localized buyer mock payment page that lets a buyer simulate success or failure for their pending payment.

## Inputs

- Goals:
  - `_goal/buyer-payment-ux.md`
  - `_goal/payment-status-trust.md`
- Contracts:
  - `_contract/checkout-payment-handoff.md`
  - `_contract/mock-payment-event-api.md`

## Route

- `app/[locale]/(buyer)/payment/mock/[paymentId]/page.tsx`

## Implementation Notes

- Require buyer authentication before rendering private payment data.
- Fetch payment/order context from a server-backed API. If no existing endpoint exposes this safely, add the narrowest buyer-owned payment detail endpoint needed.
- Display order number, amount, current payment status, and clear success/failure actions.
- Success action calls `POST /api/payments/mock/:paymentId/events` with `payment.paid`.
- Failure action calls the same endpoint with `payment.failed`.
- After event processing, redirect to `/{locale}/payment/return?orderId={orderId}`.
- Disable actions for terminal states.
- Use existing buyer visual patterns and i18n conventions.

## Verification

- Add frontend tests for success/failure action wiring and terminal-state disabled behavior where practical.
- Manual browser verification should exercise success and failure paths.

