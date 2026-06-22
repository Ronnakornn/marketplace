# task-5: Verification and Browser Evidence

## Objective

Complete milestone verification for product cart handoff UX with automated tests and browser screenshots.

## Required Automated Verification

Run focused verification:

```bash
bun run test app/features/product app/components/BuyerShell.test.tsx
bunx tsc --noEmit
```

Run full suite:

```bash
bun run test
```

## Browser Evidence

Capture desktop and mobile screenshots for:

- product detail with selected variant and add-to-cart confirmation
- listing/search product card quick-add confirmation
- disabled or failed add-to-cart state where practical

Save evidence under:

```text
.chief/milestone-15/_report/
```

## Acceptance

- Confirmation appears without layout shift.
- Add-to-cart does not navigate unexpectedly.
- Cart count refresh comes from cart API/query invalidation.
- No visible `[object Object]` messages.
- No text overlap in sticky product detail bar, card actions, or confirmation UI.

## Report

Write a short verification report under `.chief/milestone-15/_report/` summarizing:

- commands run
- browser evidence paths
- environment warnings
- any remaining backlog
