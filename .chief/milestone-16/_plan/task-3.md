# task-3: Align Home Buyer Action Handoff

## Objective

Make home quick-add, favorite, login handoff, and cart invalidation consistent with listing/detail behavior.

## Primary Files

- `app/features/marketplace/components/MarketplaceHome.tsx`
- `app/features/product/components/ProductCard.tsx`
- Cart/auth hooks or helpers already used by product card behavior.
- Existing tests for marketplace home and product card.

## Implementation Notes

- Reuse existing add-to-cart success/error helpers where available.
- Use the same buyer cart query invalidation/refetch keys as buyer shell/cart surfaces.
- Ensure add-to-cart and favorite controls stop propagation and do not trigger product navigation.
- Preserve guest login handoff semantics and return context where existing auth flow supports it.
- Convert unknown errors into readable messages.

## Acceptance Criteria

- Logged-in buyer quick-add from home shows readable confirmation and refreshes cart-related state.
- Guest quick-add/favorite offers clear login handoff.
- Favorite and add-to-cart controls do not navigate unexpectedly.
- Raw errors and `[object Object]` never appear in action feedback.

## Verification

- Add/update tests for successful quick-add, error feedback, disabled/guest behavior, and event propagation.
- Browser quick-add evidence is captured in task-5.
