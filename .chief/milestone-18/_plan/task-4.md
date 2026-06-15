# task-4: Verify Product Detail Trust/Content UX

## Objective

Prove milestone-18 with automated checks and saved browser evidence.

## Primary Files

- `app/features/product/components/ProductBuyerStates.test.tsx`
- `.chief/milestone-18/_report/`

## Implementation Notes

- Run focused product detail tests first.
- Run typecheck after implementation is stable.
- Run full test suite after focused tests and typecheck pass.
- Capture browser evidence for:
  - desktop product detail trust/content state
  - mobile product detail trust/content state
  - logged-in buyer content/trust state
- Document seed-data or browser-capture limitations if a state cannot be reached safely.
- Purchase handoff browser regression is not required unless implementation touches purchase flow.

## Acceptance Criteria

- Focused product detail tests pass.
- `bunx tsc --noEmit` passes.
- `bun run test` passes.
- Desktop and mobile evidence show trust/content sections without clipped text or overlap.
- Logged-in buyer evidence shows buyer-visible content/trust state.
- Report is saved under `.chief/milestone-18/_report/`.

## Verification Commands

- `bunx vitest run app/features/product/components/ProductBuyerStates.test.tsx`
- `bunx tsc --noEmit`
- `bun run test`
