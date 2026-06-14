# Add To Cart Confirmation UI Contract

## Scope

Show visible buyer feedback after successful add-to-cart from product detail and reusable product cards.

## Required Behavior

- Successful add-to-cart shows a lightweight toast/action-bar confirmation.
- Confirmation includes:
  - success message
  - product or variant context when safely available
  - action to view cart
  - action to continue shopping or dismiss
- Buy-now from product detail still adds the item first, then routes to cart.
- Confirmation must render on mobile and desktop.

## Implementation Constraints

- If using `sonner`, ensure a toaster is mounted in app providers/layout.
- Confirmation logic should live in product/buyer feature code, not inside generic shared UI primitives.
- Do not implement a mini cart drawer.
- Do not show pricing totals that require cart recalculation.

## Accessibility

- Confirmation must be announced by the toast/action-bar mechanism.
- Action labels must be explicit, e.g. "View cart".
- Confirmation text must not overflow compact mobile widths.
