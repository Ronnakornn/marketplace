# Contract: Verification

## Required Commands

Run after implementation:

```bash
bunx tsc --noEmit --pretty false
bunx vitest run app/features/product/components/ProductBuyerStates.test.tsx
bun run test
```

## Required Coverage

- Variant selection required state.
- Disabled reason when no valid in-stock variant is selected.
- Out-of-stock or unavailable option state.
- Quantity clamp/reset when variant stock changes.
- Sticky action summary displays selected price, variant context, quantity, and stock state.
- Existing add-to-cart behavior still works with a selected valid variant.
- Existing buy-now behavior remains compatible with the current cart/route flow.

## Browser Verification

After deterministic tests pass:

- Open a product detail page with multiple variants.
- Confirm selected, disabled, and out-of-stock option states are visually distinct.
- Confirm quantity cannot exceed selected stock.
- Confirm sticky action summary remains readable and usable on mobile and desktop viewport sizes.
- Confirm media, key facts, and specification display do not overlap or produce corrupted text.

## Documentation

Write final verification notes under:

```txt
.chief/milestone-9/_report/
```
