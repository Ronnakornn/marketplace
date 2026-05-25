# task-5: Measure buyer entry performance baseline for home and search

## Goal

Capture baseline evidence for buyer entry pages before optimization.

## Scope

- Measure `/th` and `/th/search`.
- Capture HTTP-level timings.
- Capture browser-level visible render evidence, including blank/loading duration where practical.
- Identify whether the dominant delay is route rendering, public API/data fetching, client hydration, or browser bundle work.

## Likely Files

- `.chief/milestone-1/_report/task-5/`
- No production code changes expected.

## Steps

1. Start or reuse local frontend/backend servers.
2. Measure HTTP timings for `/th` and representative `/th/search` requests.
3. Use browser automation to inspect visible render state for `/th` and `/th/search`.
4. Capture console/network errors relevant to visible performance.
5. Save baseline findings under `.chief/milestone-1/_report/task-5/`.

## Verification

- Baseline includes both HTTP-level and browser-level evidence.
- Any measurement scripts or notes stay under `.chief/milestone-1/_report/task-5/`.
- No temporary diagnostics are left in production app code.
