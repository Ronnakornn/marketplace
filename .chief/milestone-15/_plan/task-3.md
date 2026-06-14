# task-3: Product Card Quick-Add Handoff

## Objective

Update reusable `ProductCard` quick-add behavior so listing/search buyers get the same confirmation and recovery pattern as product detail.

## Scope

- `app/features/product/components/ProductCard.tsx`
- `app/features/product/components/ProductCard.test.tsx`
- Product cart handoff helper from task-1.

## Required Behavior

- Quick add remains visible only when exactly one in-stock no-option variant is safe.
- Successful quick add:
  - calls existing cart API
  - invalidates/refetches buyer cart query
  - shows visible confirmation with "View cart"
  - does not navigate to detail
  - does not trigger card navigation tracking
- Failed quick add:
  - shows readable error
  - preserves listing context and scroll
- Ambiguous products:
  - keep detail fallback action
  - do not show misleading disabled cart control

## Constraints

- Card dimensions must remain stable.
- Favorite and quick-add controls must stop propagation.
- Do not add mini cart summary to card.

## Verification

- Add/update `ProductCard` tests for success confirmation, failure, no navigation/tracking, and ambiguous fallback.
- Run:

```bash
bun run test app/features/product/components/ProductCard.test.tsx
bunx tsc --noEmit
```
