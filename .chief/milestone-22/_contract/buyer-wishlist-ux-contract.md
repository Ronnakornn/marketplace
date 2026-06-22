# Buyer Wishlist UX Contract

## Contract

The buyer wishlist page must use the existing favorites backend as the canonical saved-product source and provide a complete buyer workflow for viewing, removing, and adding saved products to cart.

## Routing and Auth Requirements

- The wishlist route remains `/[locale]/wishlist`.
- Unauthenticated users opening wishlist must be sent through the existing login flow with a return path back to wishlist.
- Product favorite buttons outside the wishlist must preserve their current behavior.
- Wishlist actions must not expose favorites for another user.

## Data Requirements

- Wishlist items come from the existing `GET /api/me/favorites` flow.
- Favorite status mutations use existing favorite add/remove APIs.
- Add-to-cart uses the existing cart API and cart query invalidation patterns.
- Frontend code must not manually duplicate backend response types when existing API helpers or inferred types can be used.

## Wishlist Page UX Requirements

- Render saved products in a responsive grid or product-card layout consistent with marketplace listing surfaces.
- Show each product with enough information for a buyer decision:
  - product image
  - title
  - price or sale price display
  - shop or relevant product metadata when available
  - rating/sold or equivalent trust signal when available
  - availability state
- Provide item-level actions:
  - remove from wishlist
  - add to cart when purchasable
  - disabled add-to-cart state when not purchasable
- Removing an item must update the visible list without requiring a manual refresh.
- Add-to-cart success must give clear feedback and keep the buyer on wishlist.
- Add-to-cart failure must show a readable retryable error or toast.

## State Requirements

- Loading state must reserve a stable layout and avoid content jump.
- Empty state must explain that no saved products exist and provide a route back to shopping.
- Error state must be readable and include retry behavior.
- Mutating states must prevent duplicate rapid submissions for the same item.
- Mobile layout must avoid overlapping text, buttons, and product imagery.

## Testing Requirements

- Focused frontend tests cover:
  - wishlist loading and populated rendering
  - empty state
  - remove-from-wishlist interaction
  - add-to-cart success path
  - disabled add-to-cart for unavailable products
  - unauthenticated login handoff if covered by local auth utilities
- Existing favorite/product detail/listing behavior must not regress.

## Browser Evidence

- Capture desktop wishlist with saved products when seed/demo data allows.
- Capture mobile wishlist layout.
- Capture empty or unauthenticated state if saved-product data is unavailable locally.

## Non-Goals

- No guest wishlist localStorage sync.
- No compare tray or compare page.
- No price history, price drop notifications, or wishlist collections.
- No database schema changes unless implementation uncovers a blocker that cannot be solved with existing favorite/cart models.
