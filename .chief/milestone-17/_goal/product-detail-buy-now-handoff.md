# Product Detail Buy Now Handoff

## Goal

Ensure Add to cart and Buy now from product detail use safe, recoverable buyer handoff behavior.

## In Scope

- Add to cart success/error confirmation.
- Buy now adds the selected variant/quantity to cart, then routes to `/cart`.
- Guest login handoff preserving the product detail return path.
- Buyer-only purchase controls.
- Cart query invalidation/refetch after successful purchase actions.

## Out of Scope

- Direct checkout creation from product detail.
- Payment status changes.
- Order creation logic.
- Mini confirmation modal/drawer.

## Constraints

- Use existing cart APIs.
- Never create order/payment success from the browser.
- Error feedback must be readable and never show raw objects.
