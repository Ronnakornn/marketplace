# Task 5: Milestone Verification And Report

## Goal

Verify milestone 10 end-to-end and record completion evidence.

## Inputs

- Goals:
  - all `_goal/*.md`
- Contracts:
  - all `_contract/*.md`
- TODO:
  - `_plan/_todo.md`

## Required Work

- Run focused backend and frontend tests added in tasks 1-4.
- Run full typecheck.
- Run full test suite unless blocked by pre-existing unrelated failures.
- Update docs only if architecture, routes, or public behavior changed in a way existing docs should capture.
- Write `.chief/milestone-10/_report/autopilot-run-batch-1.md` or a milestone completion report with:
  - completed tasks
  - verification commands and results
  - known residual risks
  - user action needed, if any

## Verification

Run:

```bash
bunx tsc --noEmit
bun run test
```

## Out Of Scope

- New feature work beyond tasks 1-4.
- Browser screenshot verification unless UI changes cannot be confidently covered by tests.
