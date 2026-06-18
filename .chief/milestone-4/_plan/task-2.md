# Task 2: Inventory Module and Stock-Safe Primitives

## Goal

Create a dedicated inventory domain module with transactional stock operations, seller inventory APIs, and movement history.

## Affected Areas

- `server/modules/inventory/**`
- `server/context/app-context.ts`
- `server/index.ts`
- checkout/payment inventory call sites if reservation logic is migrated
- tests for inventory service and routes

## Required Work

1. Add inventory repository, service, routes, and errors.
2. Implement seller APIs:
   - `GET /api/seller/inventory`
   - `GET /api/seller/variants/:variantId/inventory`
   - `PATCH /api/seller/variants/:variantId/inventory`
   - `GET /api/seller/variants/:variantId/inventory/movements`
3. Implement service primitives:
   - `adjustStock`
   - `reserveStock`
   - `releaseReservation`
   - `commitReservation`
   - `expireReservation`
   - `restockReturn`
4. Ensure all writes run in database transactions.
5. Create `InventoryMovement` rows in the same transaction as each stock mutation.
6. Enforce seller ownership through existing active shop/ownership guards.
7. Do not allow sellers to directly set reserved quantity.

## Acceptance Criteria

- Available stock is calculated as `quantityOnHand - quantityReserved`.
- Reserve fails without partial side effects when stock is insufficient.
- Commit decrements both on-hand and reserved quantities.
- Release and expire decrement reserved quantity without changing on-hand.
- Seller cannot read or mutate another shop inventory.
- Movement records include before/after quantities, actor, reason, and reference data.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Required focused tests:

- oversell prevention
- adjustment ledger writes
- reservation create/release/commit/expire
- seller ownership failure
- transaction rollback on failed reserve
