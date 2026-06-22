# Goal: Buyer Wishlist UX Completion

## Outcome

Buyer wishlist must feel like a complete shopping surface, not a placeholder list. Authenticated buyers can review saved products, remove products, and add available products to cart from a responsive wishlist page.

## Scope

- Upgrade the buyer wishlist page:
  - product-card or product-grid presentation aligned with marketplace product surfaces
  - remove-from-wishlist interaction with immediate UI feedback
  - add-to-cart action for purchasable products
  - clear disabled states for unavailable, inactive, or out-of-stock products
  - empty, loading, error, and retry states
  - mobile and desktop responsive layout
- Preserve existing favorite APIs and product favorite entry points.
- Preserve auth behavior by sending unauthenticated users to login with a return path.
- Add focused tests for wishlist page behavior and buyer actions.
- Capture browser evidence for desktop and mobile wishlist states when seed data allows.

## Constraints

- Use existing buyer/product feature conventions, TanStack Query, and same-origin `/api/*` requests.
- Reuse existing product card, cart, and favorite APIs where practical.
- Do not introduce a new wishlist database model; `FavoriteProduct` remains the source of truth.
- Do not trust client-provided pricing or stock for cart operations.
- Keep text readable and controls non-overlapping across mobile and desktop.

## Non-Goals

- Do not build guest wishlist sync in this milestone.
- Do not add compare, collections, sharing, price-drop tracking, or personalization.
- Do not redesign cart, checkout, seller, admin, or recommendation systems.
- Do not add fake wishlist data for empty states.
