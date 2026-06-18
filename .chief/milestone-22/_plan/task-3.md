# Task 3: Wishlist Add-to-Cart Action

## Objective

Allow buyers to add purchasable wishlist products to cart directly from the wishlist page while respecting existing cart rules and availability limits.

## Affected Areas

- `app/features/buyer/components/WishlistPage.tsx`
- `app/features/cart/*`
- `app/features/product/*` if product availability helpers already live there
- focused wishlist/cart interaction tests

## Requirements

- Add item-level add-to-cart action for products that can be purchased.
- Use the existing cart API and mutation/query invalidation conventions.
- Do not trust client price, discount, or stock values; cart backend remains authoritative.
- Disable add-to-cart for products that are inactive, unavailable, or out of stock according to fields available to the frontend.
- Prevent duplicate submissions per item while mutation is pending.
- Show clear feedback for success and failure.
- Keep the buyer on the wishlist after add-to-cart succeeds.

## Done When

- Purchasable wishlist items can be added to cart.
- Unavailable wishlist items show a disabled action with clear state.
- Cart cache/state updates using existing conventions.
- `_todo.md` is updated when complete.
