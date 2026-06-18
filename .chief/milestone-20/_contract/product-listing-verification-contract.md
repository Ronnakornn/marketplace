# Product Listing Verification Contract

## Contract

Milestone-20 must verify the Product Listing/Search UX polish with focused tests and browser evidence.

## Requirements

- Run focused Product Listing/Search or ProductBuyerStates tests relevant to the changed UI.
- Run `bunx tsc --noEmit` unless blocked by the known environment timeout.
- Run `bun run test` unless blocked by known repository-wide UI test timeouts.
- Capture mobile and desktop browser evidence for Product Listing/Search.
- Capture filter/sort sheet or active chip evidence when feasible.
- Save verification notes and screenshots under `.chief/milestone-20/_report/`.

## Constraints

- Browser verification must use frontend same-origin routes.
- If verification is blocked, document exact command, URL, route state, and blocker.
- Stop local dev processes started for browser evidence after verification.

## Acceptance

- Focused tests pass.
- Typecheck/full-suite status is recorded.
- Browser evidence or exact blockers are saved under `.chief/milestone-20/_report/`.
