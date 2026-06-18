# Verification Contract

## Required Automated Verification

- Product detail tests for:
  - successful add-to-cart confirmation
  - buy-now routes to cart after mutation success
  - cart query invalidation/refetch behavior
  - readable mutation error message
  - anonymous login handoff
- Product card tests for:
  - successful quick-add confirmation
  - failed quick-add error state
  - no navigation/tracking when quick-add is clicked
  - ambiguous variant fallback still opens detail

## Required Commands

Run focused verification:

```bash
bun run test app/features/product app/components/BuyerShell.test.tsx
bunx tsc --noEmit
```

Run full suite before completion:

```bash
bun run test
```

## Browser Verification

Capture mobile and desktop evidence for:

- product detail selected variant add-to-cart confirmation
- product card quick-add confirmation on listing/search
- failed or disabled add-to-cart state where practical

## Acceptance

- No visible `[object Object]` messages.
- Confirmation appears without layout shift.
- Add-to-cart does not navigate unexpectedly.
- Cart count is refreshed from API state, not guessed.
