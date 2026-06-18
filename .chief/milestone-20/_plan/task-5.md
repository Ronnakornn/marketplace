# Task 5: Verify and Capture Browser Evidence

## Objective

Verify milestone-20 changes and capture buyer Product Listing/Search browser evidence.

## Scope

- Run focused Product Listing/Search tests.
- Run `bunx tsc --noEmit` and record result or known timeout blocker.
- Run `bun run test` and record result or known repository-wide timeout failures.
- Capture mobile and desktop Product Listing/Search screenshots.
- Capture filter/sort sheet or active chip evidence where feasible.
- Save notes and screenshots under `.chief/milestone-20/_report/`.

## Constraints

- Use frontend same-origin routes.
- Do not keep dev processes running after evidence capture.
- If browser verification is blocked, document exact URL, command, and blocker.

## Verification

- `.chief/milestone-20/_report/` contains verification notes and screenshots or exact blockers.
- Focused tests pass or failures are documented with root cause.
