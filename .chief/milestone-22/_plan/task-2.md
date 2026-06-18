# Task 2: Wishlist Page UX and Remove Flow

## Objective

Upgrade the wishlist page into a responsive buyer shopping surface with clear states and immediate remove-from-wishlist behavior.

## Affected Areas

- `app/features/buyer/components/WishlistPage.tsx`
- `app/features/buyer/api.ts`
- shared product UI components if reuse requires small prop additions
- focused wishlist tests

## Requirements

- Render saved products in a responsive grid or product-card layout aligned with product listing surfaces.
- Preserve locale-aware product links.
- Add item-level remove action that:
  - uses the existing remove favorite API
  - prevents duplicate submissions per item
  - updates wishlist data without manual refresh
  - shows readable success/failure feedback using existing app feedback patterns
- Add stable loading state.
- Add empty state with a route back to marketplace shopping.
- Add readable error state with retry.
- Ensure unauthenticated access follows the existing login flow with a return path back to wishlist.
- Keep mobile layout non-overlapping and usable with touch targets.

## Non-Goals

- Do not add add-to-cart in this task; task-3 owns it.
- Do not change backend favorite ownership rules unless an existing bug is found.

## Done When

- Wishlist page can show, remove, empty, loading, and error states.
- Existing favorite buttons outside wishlist still work.
- `_todo.md` is updated when complete.
