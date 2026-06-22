# task-5: Add tests, browser verification, and milestone report for buyer product UX/UI

## Objective

Verify milestone 13 behavior with automated tests and browser checks, then document the result.

## Affected Areas

- product frontend tests
- catalog/tracking backend tests if changed
- `.chief/milestone-13/_report/`

## Required Commands

Run:

```bash
bunx tsc --noEmit
bun run test
```

Run targeted tests first when useful:

```bash
bun run test app/features/product
bun run test server/modules/catalog
bun run test server/modules/tracking
```

## Browser Verification

Run the app and verify:

- Product detail desktop viewport.
- Product detail mobile viewport.
- Listing/search card grid desktop viewport.
- Listing/search card grid mobile viewport.

Check:

- media area is not blank unless fallback is expected
- no text overlap
- sticky purchase bar does not hide critical content
- focus states are visible
- related/recently viewed sections do not break layout

## Report

Create a report under:

```txt
.chief/milestone-13/_report/
```

Include:

- implemented tasks
- changed backend modules
- changed frontend modules
- verification commands and results
- browser viewports checked
- known UX gaps left for later

## Completion Criteria

- Required tests and typecheck pass or failures are documented.
- Browser verification has been completed.
- Milestone report exists.
- `_todo.md` is updated to reflect completed work.
