# task-2: Product Detail Add-To-Cart Handoff

## Objective

Update product detail add-to-cart and buy-now actions with visible confirmation, readable error recovery, login handoff, and cart count refresh.

## Scope

- `app/features/product/components/ProductDetailPage.tsx`
- Product detail tests under `app/features/product/components/`.
- Product cart handoff helper from task-1.

## Required Behavior

- Add-to-cart:
  - remains disabled until a valid in-stock variant is selected
  - shows stable pending state
  - invalidates/refetches buyer cart query on success
  - shows success confirmation with "View cart"
  - shows readable error message on failure
- Buy-now:
  - uses same mutation validation path
  - routes to `/cart` only after successful mutation
  - does not show guessed cart count
- Anonymous buyer:
  - routes to login before mutation
  - keeps intended product path recoverable where existing routing supports it

## Constraints

- Do not redesign cart page or checkout.
- Do not bypass existing `addCartItem` API.
- Do not trust client-side price/stock for final cart state.

## Verification

- Add/update product detail tests for success confirmation, buy-now route, mutation error, and anonymous login handoff.
- Run:

```bash
bun run test app/features/product/components/ProductBuyerStates.test.tsx
bunx tsc --noEmit
```
