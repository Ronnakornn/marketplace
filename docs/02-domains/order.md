# Order Domain

The Order domain owns buyer orders, order item snapshots, order status, and order tracking views.

## Responsibilities

- Orders
- Order items
- Order item snapshots
- Shipping address snapshots
- Order status
- Buyer order list
- Order detail
- Review and return eligibility signals

## Business Rules

- One order can contain items from many shops.
- Order items store product, variant, shop, price, and quantity snapshots.
- Shipping address is snapshotted at order creation.
- Order status follows payment and fulfillment state.
- Buyers can only access their own orders.
- Admins can monitor all orders.

## Statuses

- Pending payment
- Paid
- Partially fulfilled
- Fulfilled
- Canceled
- Refunded

## API Surface

- `GET /api/orders`
- `GET /api/orders/:orderId`
- `GET /api/orders/:orderId/payment-status`
- `GET /api/admin/orders`

## Frontend Surfaces

- Orders list
- Order detail
- Payment return
- Shipment tracking
- Admin order monitoring

## Edge Cases

- Payment pending for too long.
- Some shop shipments delivered while others are pending.
- Order canceled after payment failure.
- Refund partially completed.

## Acceptance Criteria

- Buyer order detail separates payment, order, and shipment status.
- Order detail displays per-shop shipment cards.
- Historical item and address data uses snapshots.
