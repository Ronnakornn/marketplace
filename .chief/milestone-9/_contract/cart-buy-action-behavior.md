# Contract: Cart And Buy Action Behavior

## Applies To

Buyer add-to-cart and buy-now controls on the product detail page.

## Existing Behavior

- Add-to-cart uses the current cart mutation path.
- Buy-now keeps the current implementation behavior for this milestone.
- Any route navigation after buy-now must use the existing supported cart/checkout path already implemented in the app.

## Required Behavior

- Add-to-cart and buy-now must be disabled until required variant and stock requirements are satisfied.
- Disabled actions must expose a buyer-readable reason before click.
- Successful add-to-cart behavior must remain compatible with existing cart tests and cart state.
- Buy-now must not introduce a new checkout session, inventory reservation, payment, or order flow.
- UI must not trust client stock as final authority; server-side cart/checkout validation remains required.

## Error Handling

- Existing mutation errors must remain visible to the buyer.
- Error text must not hide the selected variant, stock, or quantity context.
- Loading states must prevent duplicate accidental submissions.

## Out of Scope

- Cart API contract changes.
- Direct checkout backend flow.
- Inventory reservation.
- Payment initiation.
- Order creation.
