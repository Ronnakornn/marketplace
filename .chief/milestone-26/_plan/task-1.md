# Task 1: Checkout Payment URL Generation And Handoff

## Objective

Make successful checkout responses include a usable mock payment URL and update the checkout UI to continue through that URL.

## Inputs

- Goals:
  - `_goal/buyer-payment-ux.md`
  - `_goal/payment-status-trust.md`
- Contracts:
  - `_contract/checkout-payment-handoff.md`

## Implementation Notes

- Update checkout service response generation so `POST /api/checkout` returns `paymentUrl`.
- Use route shape `/{locale}/payment/mock/{paymentId}`.
- Use checkout request `locale` when provided; otherwise use the app's stable default locale.
- Preserve existing checkout behavior:
  - cart ownership validation
  - address ownership validation
  - stock validation
  - coupon validation
  - pending order/payment creation
  - reservation behavior
- Update frontend checkout success handling to navigate or link through `paymentUrl`.
- Do not mark payment as succeeded from checkout UI.

## Verification

- Add or update backend checkout tests for `paymentUrl`.
- Add or update frontend checkout tests for using `paymentUrl`.
- Confirm existing checkout tests still pass.

