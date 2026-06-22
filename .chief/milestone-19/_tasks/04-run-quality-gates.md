# Task 04: Run Quality Gates

## Objective

Verify the route/SEO fix with focused tests, typecheck, and the full test suite.

## Scope

- Run focused regression tests for milestone-19 changes.
- Run `bunx tsc --noEmit`.
- Run `bun run test`.
- Save command summary in `.chief/milestone-19/_report/verification.md`.

## Constraints

- If a failure is unrelated and pre-existing, document exact evidence before deciding whether to leave it.
- Do not skip typecheck or full tests unless blocked by environment.
- Do not hide failures; document blockers with command, failure summary, and next action.

## Verification

- Focused tests pass.
- Typecheck passes.
- Full test suite passes or a concrete blocker is documented.
