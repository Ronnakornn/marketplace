# Goal: Inventory Control

## Outcome

Inventory becomes a dedicated domain with stock-safe operations and auditable stock movement history.

## Scope

- Add a dedicated `server/modules/inventory/` module.
- Provide seller inventory read/update APIs for variant stock.
- Add inventory movement ledger for stock adjustments, reservations, releases, commits, sales, and restocks.
- Keep reservation, commit, and release operations transactional.
- Do not implement warehouse/location-level inventory in this milestone.

## Success Criteria

- Inventory writes use database transactions.
- Seller inventory edits enforce shop ownership.
- Stock changes record actor, reason, before/after quantities, and quantity delta.
- Checkout/payment inventory behavior can use inventory service primitives without trusting client stock state.
