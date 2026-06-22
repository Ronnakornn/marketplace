# task-1: Product Cart Handoff Confirmation Infrastructure

## Objective

Mount buyer-visible confirmation infrastructure and add a feature-level helper for add-to-cart success/error messaging.

## Scope

- `app/providers.tsx` or app-level provider/layout location needed to mount an existing toaster.
- `app/components/ui/sonner.tsx` only if existing toaster wrapper needs configuration.
- New or existing product/buyer feature helper for cart handoff messaging.
- Tests if provider/helper behavior needs direct coverage.

## Required Behavior

- Successful product add-to-cart can show a visible toast/action-bar confirmation.
- Confirmation supports:
  - success title/message
  - safe product/variant context
  - "View cart" action
  - dismiss/continue-shopping behavior
- Failed add-to-cart can show a readable error message.
- Error normalization must avoid `[object Object]`.

## Constraints

- Prefer existing `sonner` dependency if suitable.
- Do not place product business logic in generic shared UI primitives.
- Do not implement mini cart drawer.
- Do not show cart totals or prices that require recalculation.

## Verification

- Run focused tests covering any helper behavior added.
- Run:

```bash
bun run test app/features/product app/components/BuyerShell.test.tsx
bunx tsc --noEmit
```
