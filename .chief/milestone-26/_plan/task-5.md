# Task 5: Verification And Evidence

## Objective

Run focused automated checks and capture concise evidence that the buyer payment UX milestone is complete.

## Inputs

- Goals:
  - `_goal/payment-verification.md`
- Contracts:
  - all milestone-26 contracts

## Required Commands

- Run focused backend tests for checkout/payment/order modules touched in this milestone.
- Run focused frontend tests for checkout, mock payment, and payment return components touched in this milestone.
- Run `bunx tsc --noEmit`.

## Manual Verification

- Start the app using the repository's standard dev command if browser verification is needed.
- Complete checkout and confirm the UI continues to mock payment page via `paymentUrl`.
- Simulate success and confirm payment return/order detail show succeeded/paid state.
- Simulate failure and confirm payment return shows failure without unsupported retry.
- Visit return page before event processing and confirm status remains pending.

## Report

Write `.chief/milestone-26/_report/task-5/verification.md` with:

- commands run
- pass/fail result
- browser scenarios checked
- any residual risks or follow-up work

