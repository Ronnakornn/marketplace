# Product Detail Browser Verification Contract

## Contract

Milestone-19 must restore reliable browser evidence for buyer product detail UX verification.

## Requirements

- Capture desktop browser evidence for a known active product detail route.
- Capture mobile browser evidence for the same route.
- Capture logged-in buyer browser evidence for product detail buyer-visible state.
- Save screenshots and notes under `.chief/milestone-19/_report/`.
- Browser verification must use same-origin frontend routes.
- Local dev processes started for verification must be stopped after evidence is collected.

## Verification

- Run focused regression tests for the product detail route/SEO fix.
- Run `bunx tsc --noEmit`.
- Run `bun run test`.
- If browser evidence is blocked by environment or seed state, document the exact URL, API result, route result, and blocker under `.chief/milestone-19/_report/`.

## Non-Goals

- Do not certify cross-browser behavior.
- Do not validate payment provider flows.
- Do not extend browser evidence to checkout unless product detail route changes directly affect purchase handoff.
