# task-4: Verify seller performance improvements and remove diagnostics

## Goal

Confirm the seller performance work improves the `/th/seller` user-visible load path and leaves no temporary diagnostic code behind.

## Scope

- Compare `/th/seller` before/after evidence from task-1.
- Validate seller route behavior manually in browser.
- Run deterministic checks.
- Remove temporary logging, counters, and measurement-only code from production paths.

## Likely Files

- `.chief/milestone-1/_report/task-4/`
- Any files changed by tasks 2 and 3

## Steps

1. Re-run local `/th/seller` measurement.
2. Compare request counts, render timing, and visible blank/Rendering behavior against task-1.
3. Verify seller navigation and dashboard render for active seller state.
4. Verify onboarding/status routes still redirect/render correctly.
5. Run required automated checks.
6. Document final evidence under `.chief/milestone-1/_report/task-4/`.

## Verification

- `bunx tsc --noEmit`
- Focused seller frontend tests pass.
- Relevant seller dashboard/cache backend tests pass.
- No temporary diagnostics remain in production execution paths.
