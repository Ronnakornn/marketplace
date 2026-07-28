# Task 4: Payment Return Polling And Status Consistency

## Objective

Improve buyer payment return behavior so it polls pending states, stops on terminal states, and stays consistent with order detail.

## Inputs

- Goals:
  - `_goal/buyer-payment-ux.md`
  - `_goal/payment-status-trust.md`
- Contracts:
  - `_contract/payment-return-status-ui.md`

## Implementation Notes

- Keep route `/{locale}/payment/return?orderId={orderId}`.
- Read order/payment status from server order data.
- Poll approximately every 2 seconds while status is pending or requires action.
- Stop polling on terminal states:
  - succeeded
  - failed
  - canceled
  - refunded
- Stop polling after a bounded timeout around 30-60 seconds.
- Ensure return page copy clearly distinguishes pending, success, failure/canceled, and refunded states.
- Ensure order detail/list payment status presentation does not contradict the return page.
- Do not offer retry-from-order in this milestone.

## Verification

- Add frontend tests for polling while pending and stopping on terminal state.
- Manual verification must confirm that simply visiting return page does not mark payment successful.

