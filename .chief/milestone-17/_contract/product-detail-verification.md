# Product Detail Verification Contract

## Purpose

The milestone must prove product detail UX/UI behavior with focused tests and browser evidence.

## Automated Verification

- Run focused product detail tests covering selected variant, quantity, stock disabled state, add-to-cart success/error, buy-now success, guest login handoff, and non-buyer disabled state.
- Run `bunx tsc --noEmit`.
- Run `bun run test` when focused tests and typecheck pass.

## Browser Evidence

- Capture desktop product detail screenshot.
- Capture mobile product detail screenshot.
- Capture logged-in buyer Add to cart or Buy now handoff evidence.
- Save screenshots or notes under `.chief/milestone-17/_report/`.

## Acceptance Checks

- No text overlap or clipped controls in the decision panel or sticky buy bar.
- Add to cart success keeps product detail context and shows confirmation.
- Buy now success routes to `/cart`.
- Guest/non-buyer states are covered by tests even if not captured in browser evidence.

## Boundaries

- Browser evidence may document seed-data limitations instead of forcing unsafe state changes.
- Cross-browser certification, load testing, and payment provider validation are not required.
