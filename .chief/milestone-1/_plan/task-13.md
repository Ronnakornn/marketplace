# task-13: Verify seller product CRUD production readiness and type safety

## Goal

Verify that the seller product CRUD milestone works end to end at the component/type level, meets the approved production-readiness criteria, and leaves no temporary diagnostics.

## Scope

- Run focused tests added or touched by task-9 through task-12.
- Run `bunx tsc --noEmit`.
- If backend code changed, run relevant catalog service/API tests.
- Inspect production paths for temporary logs, debug helpers, or measurement-only code.
- Capture a short report under `.chief/milestone-1/_report/` summarizing:
  - implemented CRUD coverage
  - production-readiness coverage
  - tests run
  - any known gaps or follow-up recommendations

## Acceptance Checks

- `/seller/products` provides product create/edit/archive.
- `/seller/products` provides variant create/edit/delete.
- Product archive is labeled as archive.
- Archive and variant delete actions require confirmation.
- Page-level product loading failures provide retry.
- Product and variant mutation failures preserve form data.
- Product and variant dialogs protect unsaved edits on close.
- Dialogs, form fields, row actions, loading states, empty states, and error states meet the practical accessibility contract.
- The product table remains usable on mobile/tablet without breaking layout.
- Shared data table remains domain-agnostic.
- No unrelated table screens were refactored.
- Typecheck passes.
