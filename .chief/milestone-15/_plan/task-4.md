# task-4: Product Action State Accessibility Alignment

## Objective

Align pending, disabled, success, and error states across product detail and listing/search cards so add-to-cart handoff is accessible and visually stable.

## Scope

- `ProductDetailPage`
- `ProductCard`
- Product tests for state labels and no unexpected navigation.

## Required Behavior

- Pending states use stable labels and do not resize buttons/cards.
- Disabled states explain:
  - missing variant
  - out of stock
  - login-required where applicable
  - seller/non-buyer cannot purchase where applicable
- Error messages are readable and compact.
- Icon-only actions have accessible labels.
- Confirmation action labels are explicit.

## Constraints

- Do not alter cart/checkout logic.
- Do not introduce layout shift in card grid or sticky product detail bar.
- Keep text readable on mobile.

## Verification

- Add/update tests for accessible labels and disabled/pending/error states.
- Run:

```bash
bun run test app/features/product
bunx tsc --noEmit
```
