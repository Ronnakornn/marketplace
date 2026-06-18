# Task 5: Verification and Browser Evidence

## Objective

Verify milestone-21 backend and frontend behavior and capture product detail review/Q&A evidence.

## Required Verification

- Run focused backend tests:
  - review module tests touched by task-1
  - product-question module tests touched by task-2
- Run focused frontend tests:
  - `app/features/product/queries.test.ts`
  - `app/features/product/components/ProductBuyerStates.test.tsx`
- Run:
  - `bunx tsc --noEmit`
  - `bun run test`

## Browser Evidence

Capture screenshots under `.chief/milestone-21/_report/`:

- desktop product detail review/Q&A controls
- mobile product detail review/Q&A controls
- one filtered or paginated state if local seed data supports it

If local seed data does not expose enough reviews/questions, document the limitation and still capture the available product detail state plus API verification.

## Reports

Create:

- `.chief/milestone-21/_report/verification.md`
- `.chief/milestone-21/_report/browser-evidence.md`
- `.chief/milestone-21/_report/autopilot-run-batch-1.md`

## Known Risk

`bun run test` may still surface unrelated seller page timeout failures from earlier work. If that happens, record exact failing files/tests and separate them from milestone-21 focused verification.

## Done When

- Focused tests and typecheck pass.
- Full test result is recorded honestly.
- Browser evidence is saved or limitation is documented.
- `.chief/milestone-21/_plan/_todo.md` marks completed tasks after implementation/verification.

