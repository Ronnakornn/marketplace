# Inventory Domain

The Inventory domain owns stock quantities, reserved stock, low-stock signals, and stock-safe updates.

## Responsibilities

- Quantity on hand
- Reserved quantity
- Available quantity
- Reorder level
- Inventory reservation
- Stock commit/release
- Seller stock edits

## Business Rules

- Available quantity is derived from on-hand minus reserved.
- Checkout reserves stock before payment intent creation.
- Payment success commits reserved stock.
- Payment failure, cancellation, or checkout expiry releases reserved stock.
- Inventory updates must use database transactions.
- Sellers cannot reduce available stock below reserved commitments without a valid domain workflow.

## API Surface

- `PATCH /api/seller/variants/:variantId/inventory`
- Checkout reservation APIs
- Payment webhook stock commit/release flow

## Frontend Surfaces

- Product detail stock hint
- Cart availability warnings
- Checkout reservation errors
- Seller inventory management
- Admin exception monitoring

## Edge Cases

- Oversell race condition.
- Reservation expiry.
- Payment webhook duplicate.
- Seller stock edit during active checkout.
- Low stock threshold reached.

## Acceptance Criteria

- Stock reservation prevents overselling.
- Stock changes are transactional.
- Reserved stock is visible in seller inventory views.
