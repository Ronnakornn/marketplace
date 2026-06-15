# task-3: Harden Add To Cart and Buy Now Handoff

## Objective

Ensure product detail purchase actions use existing cart infrastructure safely, with recoverable feedback and correct navigation behavior.

## Primary Files

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/cart-handoff.ts`
- `app/features/product/components/ProductBuyerStates.test.tsx`

## Implementation Notes

- Add to cart and Buy now must share the same selected variant and quantity validation.
- Add to cart success stays on product detail and shows confirmation.
- Buy now success routes to `/cart` after add-to-cart succeeds.
- Buy now must not navigate if add-to-cart fails.
- Invalidate/refetch buyer cart query keys used by cart and shell surfaces.
- Guest actions route to login with `next=/products/<productId>`.
- Non-buyer sessions must remain blocked with readable reason.

## Acceptance Criteria

- Add to cart success shows readable product/variant confirmation and refreshes cart state.
- Buy now success navigates to `/cart` only after cart mutation success.
- Add-to-cart error keeps the buyer on product detail and shows readable error feedback.
- Guest and non-buyer paths are deterministic and covered by tests.
- No checkout/order/payment success is created from product detail.

## Verification

- Add or update tests for add-to-cart success, add-to-cart failure, buy-now success, buy-now failure, guest login handoff, non-buyer disabled state, and cart invalidation.
- Browser buyer action evidence is captured in task-4.
