# task-5: Verify Auth v1 with focused backend/frontend tests, typecheck, and documentation updates

## Objective

Prove Auth v1 works end to end at the contract level and update documentation where behavior or schema changed.

## Scope

- Run required generation and verification commands after implementation:
  - `bun run db:generate`
  - `bunx tsc --noEmit`
  - focused Vitest suites for auth/user/admin behavior
- Add missing focused tests required by the Auth v1 contract.
- Update docs when architecture, schema, or user-visible auth behavior changed.
- Confirm out-of-scope items remain unimplemented:
  - phone login
  - phone verification
  - social login
  - RBAC tables
  - admin invite flow

## Constraints

- Do not treat generated files as manually authored changes.
- Do not skip generation after Prisma schema changes.
- Do not broaden tests into unrelated marketplace domains unless Auth v1 changes affect them.

## Implementation Notes

- Prefer focused test runs during iteration, then run the agreed final verification commands.
- If a command cannot run in the local environment, capture the blocker clearly in the task report.
- Documentation updates should be concise and limited to changed auth behavior/contracts.

## Verification

- Produce a task report under `.chief/milestone-2/_report/task-5/` or equivalent milestone report location summarizing:
  - commands run
  - tests added/updated
  - docs updated
  - any residual risks or blocked verification
