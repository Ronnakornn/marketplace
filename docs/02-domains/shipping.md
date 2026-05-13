# Shipping Domain

The Shipping domain owns shipment creation, seller shipment processing, tracking, and delivery status.

## Responsibilities

- Shipment records
- Shipment items
- Shipment split by shop
- Seller pick/pack/ship workflow
- Tracking numbers
- Shipping provider events
- Buyer tracking timeline

## Business Rules

- Shipments are created after order is paid.
- One shipment belongs to one shop.
- One order can have many shipments.
- Each seller can only process shipments for their shop.
- Shipment item quantities support partial shipment.
- Buyer tracking shows order-level status and per-shop shipment status.

## Statuses

- Pending
- Ready
- Shipped
- Delivered
- Canceled

## API Surface

- `GET /api/seller/shipments`
- `POST /api/seller/shipments/:shipmentId/ship`
- `POST /api/shipping/webhook`
- `GET /api/orders/:orderId`

## Frontend Surfaces

- Seller shipment queue
- Seller shipment detail
- Buyer order detail
- Admin order monitoring

## Edge Cases

- One shop ships before another.
- Tracking number missing.
- Carrier webhook delayed.
- Partial shipment.
- Shipment canceled due to refund.

## Acceptance Criteria

- Shipment cards are grouped by shop.
- Seller cannot process another shop shipment.
- Buyer can see per-shop tracking status.
