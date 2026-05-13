# Seller Domain

The Seller domain owns seller-facing operations for shops, products, inventory, shipments, promotions, finance summaries, and chat.

## Responsibilities

- Seller dashboard
- Shop-scoped product management
- Inventory management
- Shipment processing
- Promotion management
- Finance summary
- Seller chat inbox

## Business Rules

- Seller access is scoped to owned shop resources.
- Seller order processing is shipment-based, not whole-order based.
- Seller inventory edits must respect reserved stock.
- Seller cannot mark payment success.
- Seller cannot alter buyer order snapshots.

## API Surface

- `GET /api/seller/dashboard`
- `GET /api/seller/products`
- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`
- `PATCH /api/seller/variants/:variantId/inventory`
- `GET /api/seller/shipments`
- `POST /api/seller/shipments/:shipmentId/ship`
- `GET /api/seller/finance`
- `GET /api/seller/promotions`

## Frontend Surfaces

- Seller dashboard
- Seller product management
- Seller inventory
- Seller order processing
- Seller finance
- Seller promotions
- Seller chat

## Edge Cases

- Shop verification pending.
- Shop suspended.
- Product rejected by moderation.
- Low stock with reserved inventory.
- Shipment canceled/refunded.

## Acceptance Criteria

- Seller pages enforce shop ownership.
- Dashboard highlights pending shipments and low stock.
- Shipment processing requires carrier and tracking number.
