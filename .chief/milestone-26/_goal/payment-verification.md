# Payment Verification

## Goal

Verify the new payment UX with focused automated coverage and a short manual browser pass.

## Required Checks

- Backend tests cover mock payment event processing for success, failure, idempotency, ownership, and invalid transition cases.
- Checkout tests cover `paymentUrl` generation and preserve existing order/payment creation behavior.
- Frontend tests cover checkout payment handoff and payment return state rendering.
- Payment return behavior must poll while payment is pending or requires action and stop polling on terminal states.
- Typecheck must pass with `bunx tsc --noEmit`.
- Focused tests for touched modules must pass.

## Manual Verification

- Run buyer checkout through the mock payment page.
- Simulate successful payment and confirm payment return and order detail show paid/succeeded status.
- Simulate failed payment and confirm payment return shows failure without offering unsupported retry behavior.
- Confirm browser return alone does not mark payment successful.

