# Milestone 17 TODO: Product Detail Buyer UX/UI

- [x] task-1: Refine product detail decision panel state and layout
  - Make price, stock, selected variant/SKU, quantity, and disabled purchase reasons clear and stable.
  - Ensure option chips, standalone variants, and unavailable/out-of-stock states are readable on mobile and desktop.

- [x] task-2: Improve sticky buy bar responsiveness and accessibility
  - Keep Add to cart and Buy now tappable on mobile without text overflow.
  - Align status text, quantity summary, wishlist, and chat seller controls with the sticky buy bar contract.

- [x] task-3: Harden Add to cart and Buy now handoff
  - Keep Add to cart on product detail with confirmation and cart invalidation.
  - Ensure Buy now adds the selected variant/quantity and routes to `/cart` only after success.
  - Preserve guest login return path and non-buyer disabled state.

- [x] task-4: Verify product detail UX/UI behavior
  - Add/update focused tests for variant selection, quantity bounds, stock disabled state, add-to-cart, buy-now, guest, and non-buyer states.
  - Run typecheck, focused tests, full tests, and save desktop/mobile/buyer action browser evidence under `.chief/milestone-17/_report/`.
