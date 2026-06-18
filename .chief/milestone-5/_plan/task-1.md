# Task 1: Seller Product List and Product Studio Shell

## Goal

Create the seller entry points and Product Studio shell so sellers can browse products and edit a draft from a single sectioned workspace.

## Dependencies

- Milestone 4 seller product APIs.
- Existing seller shell/navigation conventions.

## Affected Areas

- `app/seller/products/**`
- `app/features/seller/**`
- `app/features/catalog/**`
- `app/features/product/**`
- shared UI only for generic primitives

## Required Work

1. Build `/seller/products` with search, status filter, product rows/cards, pagination or cursor loading, and create product entry.
2. Build `/seller/products/new` flow that creates or prepares a draft and sends the seller into the editor.
3. Build `/seller/products/:productId` Product Studio shell.
4. Add persistent editor header with product title, status badge, save state, and primary actions.
5. Add section navigation for Basics, Category & Specs, Media, Variants, Inventory, Review.
6. Implement Basics section enough for draft editing:
   - title
   - descriptions
   - brand when available
   - meta fields when available
   - condition, warranty, origin when available
7. Add loading, empty, error, forbidden, and mutation pending states.

## Acceptance Criteria

- Seller can open product list, create a draft, and reach Product Studio.
- Product Studio sections are navigable without losing draft state.
- Save state is visible after mutations.
- UI uses Eden Treaty inferred types and React Query.
- Shared UI components do not contain seller product business rules.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- seller product list desktop
- seller product list mobile
- Product Studio shell desktop
- Product Studio shell mobile
