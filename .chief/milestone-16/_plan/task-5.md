# task-5: Verify Home UX/UI With Tests and Browser Evidence

## Objective

Prove the completed buyer home milestone with automated checks and saved browser evidence.

## Primary Files

- `app/features/marketplace/components/MarketplaceHome.test.tsx`
- `app/features/product/components/ProductCard.test.tsx`
- `.chief/milestone-16/_report/`

## Implementation Notes

- Run focused tests first so failures are easy to diagnose.
- Run typecheck before final acceptance.
- Run broader tests if focused tests and typecheck pass and runtime is reasonable.
- Use browser evidence for desktop home, mobile home, and logged-in buyer quick-add.
- Document any non-blocking local development warnings in the report.

## Acceptance Criteria

- `bunx tsc --noEmit` passes.
- Focused tests for marketplace home/product-card integration pass.
- Desktop and mobile browser evidence show no overlapping hero, rail, sticky CTA, toast, or bottom nav UI.
- Logged-in buyer quick-add evidence shows successful handoff.
- Evidence or notes are saved under `.chief/milestone-16/_report/`.

## Verification Commands

- `bunx tsc --noEmit`
- Focused test command chosen from the existing test setup.
- `bun run test` when practical after focused checks pass.
