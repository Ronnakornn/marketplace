# Home Buyer Action Handoff

## Goal

Ensure buyer actions on the home page have the same successful and recoverable handoff behavior as product listing and detail surfaces.

## In Scope

- Home quick-add success confirmation.
- Readable quick-add error handling.
- Cart query invalidation/refetch after successful add-to-cart.
- Guest login handoff for home quick-add.
- No unexpected navigation when adding to cart or tapping favorite controls.

## Out of Scope

- Cart conflict resolution redesign.
- Checkout validation redesign.
- Payment state changes.

## Constraints

- Use existing cart API and cart query keys.
- Error messages must not show `[object Object]`.
- Confirmation UI must remain readable on mobile and desktop.
