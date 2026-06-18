# Task 4: Wishlist Focused Tests

## Objective

Add focused automated coverage for the upgraded wishlist behavior.

## Affected Areas

- wishlist component tests
- buyer API helper tests if existing patterns require them
- cart mutation mock setup where needed

## Requirements

- Cover populated wishlist rendering.
- Cover empty state.
- Cover loading and error states where local test patterns support them.
- Cover remove-from-wishlist interaction and cache/UI update behavior.
- Cover add-to-cart success path.
- Cover disabled add-to-cart for unavailable products.
- Cover unauthenticated login handoff if local auth test utilities make it practical.
- Avoid brittle snapshot-only tests.

## Done When

- Focused wishlist tests pass.
- Existing product/favorite/cart tests still pass or are updated only for intentional behavior changes.
- `_todo.md` is updated when complete.
