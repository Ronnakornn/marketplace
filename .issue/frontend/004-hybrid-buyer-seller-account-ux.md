# Frontend Issue 004: Hybrid Buyer Seller Account UX

## Impact

A user can be both buyer and seller. Buyer shell, account menu, cart, checkout, orders, reviews, returns, and chat must not disappear because the user owns a shop.

## Tasks

- Add "Start Selling" entry point to header/profile/account menu.
- Keep cart and checkout visible for authenticated non-admin users.
- Keep buyer orders, reviews, returns, and buyer chat available to shop owners.
- Decide chat inbox split between buyer chat and seller chat.
- Add account/profile status card for seller application/shop state.

## Acceptance Criteria

- Active shop owner can buy products normally.
- Buyer cart/checkout/order UX remains unchanged for shop owners.
- Seller entry points do not replace buyer navigation.
