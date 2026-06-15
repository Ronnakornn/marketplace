# task-4: Verify Product Detail UX/UI Behavior

## Objective

Prove milestone-17 with automated checks and saved browser evidence.

## Primary Files

- `app/features/product/components/ProductBuyerStates.test.tsx`
- `.chief/milestone-17/_report/`

## Implementation Notes

- Run focused product detail tests first.
- Run typecheck after implementation is stable.
- Run the full test suite after focused tests and typecheck pass.
- Capture browser evidence for desktop product detail, mobile product detail, and a logged-in buyer Add to cart or Buy now handoff.
- Document seed-data limitations if a live browser path cannot safely reach a required state.

## Acceptance Criteria

- Focused product detail tests pass.
- `bunx tsc --noEmit` passes.
- `bun run test` passes.
- Desktop and mobile product detail evidence shows no clipped controls or overlapping sticky buy bar content.
- Buyer action evidence shows purchase handoff behavior or documents safe limitation.
- Report is saved under `.chief/milestone-17/_report/`.

## Verification Commands

- `bunx vitest run app/features/product/components/ProductBuyerStates.test.tsx`
- `bunx tsc --noEmit`
- `bun run test`
