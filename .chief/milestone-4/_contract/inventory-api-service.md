# Contract: Inventory API and Service

## Module Boundary

Create `server/modules/inventory/` with:

- repository
- service
- routes
- errors
- tests

Catalog may read availability for product responses, but stock mutation logic belongs to inventory services.

## Seller APIs

Required endpoints:

- `GET /api/seller/inventory`
- `GET /api/seller/variants/:variantId/inventory`
- `PATCH /api/seller/variants/:variantId/inventory`
- `GET /api/seller/variants/:variantId/inventory/movements`

Rules:

- Seller APIs use `{ withAuth: true }`.
- Seller APIs enforce shop ownership.
- Seller stock adjustments require a reason.
- Seller cannot set `quantityReserved` directly.

## Service Primitives

Inventory service exposes transactional methods:

- `adjustStock`
- `reserveStock`
- `releaseReservation`
- `commitReservation`
- `expireReservation`
- `restockReturn`

Rules:

- Reservation checks available stock as `quantityOnHand - quantityReserved`.
- Reserve increments reserved quantity and creates an active reservation.
- Release decrements reserved quantity and marks reservation released or expired.
- Commit decrements on-hand and reserved quantities.
- All writes create `InventoryMovement` rows in the same transaction.
- Client-provided stock availability is never trusted.
