# Task 1: Wishlist Integration Audit

## Objective

Map the existing wishlist/favorite, cart, product card, and auth flows before implementation so the milestone builds on current behavior instead of duplicating it.

## Affected Areas

- `app/[locale]/(buyer)/wishlist/page.tsx`
- `app/features/buyer/components/WishlistPage.tsx`
- `app/features/buyer/api.ts`
- `app/features/product/components/ProductCard.tsx`
- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/cart/*`
- `server/modules/user/*`
- `server/modules/cart/*`

## Requirements

- Confirm current favorite endpoints and frontend helpers:
  - list favorite products
  - fetch favorite status
  - add favorite
  - remove favorite
- Confirm how product cards currently render price, image, shop metadata, rating, and favorite state.
- Confirm existing cart add-item mutation shape and query invalidation pattern.
- Confirm current unauthenticated behavior for wishlist route and favorite buttons.
- Identify product availability fields available to the frontend.
- Write findings to `.chief/milestone-22/_report/task-1/wishlist-integration-audit.md`.

## Done When

- Integration points are documented.
- Any implementation blocker is called out before UI work starts.
- `_todo.md` is updated when complete.
