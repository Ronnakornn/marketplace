# Task 5: Milestone Verification and Report

## Goal

Verify milestone 8 end-to-end and document results.

## Affected Areas

- `.chief/milestone-8/_report/`
- Any small milestone-caused fixes found during verification

## Required Work

1. Run:
   - `bun run db:generate`
   - `bunx tsc --noEmit --pretty false`
   - focused Vitest command from `.chief/milestone-8/_contract/verification.md`
   - `bun run test`
2. Browser verify seller product studio:
   - number spec control renders.
   - boolean spec control renders.
   - required spec hints render.
   - additional free-form specs remain available.
3. Record:
   - tasks completed
   - commits
   - verification commands and results
   - browser verification notes
   - known follow-up backlog

## Out of Scope

- New feature scope beyond tasks 1-4.
- Fixing unrelated test failures unless milestone 8 caused them.

## Acceptance Criteria

- Full test suite passes or unrelated failures are documented with evidence.
- Typecheck passes.
- Browser verification is documented.
- Milestone TODO is fully marked complete after verification.

## Report Path

```txt
.chief/milestone-8/_report/autopilot-run-batch-1.md
```
