# task-8: Verify buyer entry improvements and clean diagnostics

## Goal

Confirm buyer entry performance improved and leave the codebase without temporary diagnostics in production paths.

## Scope

- Re-run `/th` and `/th/search` HTTP-level measurements.
- Re-run browser-level visible render checks.
- Compare against task-5 baseline.
- Run required automated checks.
- Document final evidence.

## Likely Files

- `.chief/milestone-1/_report/task-8/`
- Any production files changed by tasks 6 and 7

## Steps

1. Re-run the same measurement approach from task-5.
2. Compare before/after evidence for `/th` and `/th/search`.
3. Verify public/private cache boundaries remain intact.
4. Run focused tests for changed modules.
5. Run `bunx tsc --noEmit`.
6. Save final verification under `.chief/milestone-1/_report/task-8/`.

## Verification

- HTTP-level and browser-level after evidence exists.
- Focused changed-module tests pass.
- `bunx tsc --noEmit` passes.
- Temporary scripts/logs are isolated under `.chief/milestone-1/_report/`.
