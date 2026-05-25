# task-1: Measure seller page performance baseline

## Goal

Capture a local baseline for `/th/seller` before further optimization so later changes can be compared against evidence.

## Scope

- Measure the user-visible delay from navigation to usable seller shell/dashboard.
- Capture request count or repeated request behavior for `/th/seller`.
- Identify whether the dominant delay is:
  - route/RSC rendering
  - auth/seller access checks
  - dashboard API/data fetching
  - client-side rendering

## Likely Files

- No production code changes expected.
- Temporary local notes may be placed under `.chief/milestone-1/_report/task-1/` if useful.

## Steps

1. Start the local app if not already running.
2. Open `/th/seller` as an authenticated active seller.
3. Record observable request count and timing symptoms.
4. Inspect browser console and network/runtime errors.
5. Summarize baseline findings in `.chief/milestone-1/_report/task-1/`.

## Verification

- Baseline includes enough detail to compare before/after.
- No temporary diagnostics are left in production app code.
