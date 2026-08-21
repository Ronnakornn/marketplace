# Admin Domain

The Admin domain owns platform operations and exception management.

## Responsibilities

- Admin dashboard
- User management
- Shop management
- Product moderation
- Order monitoring
- Refund/return management
- Commission management
- Reports

## Business Rules

- Admin routes require admin role.
- Admin can inspect marketplace exceptions across users, shops, products, orders, payments, shipments, and refunds.
- Admin decisions should record reason and audit context.
- Admin UI must separate customers from system users.

## API Surface

- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `GET /api/admin/shops`
- `PATCH /api/admin/shops/:shopId/status`
- `GET /api/admin/products/moderation`
- `PATCH /api/admin/products/:productId/moderation`
- `GET /api/admin/orders`
- `GET /api/admin/reports`
- `GET /api/admin/commissions`
- `PATCH /api/admin/commissions/:commissionId/status`
- `GET /api/admin/settings`
- `PUT /api/admin/settings/:key`
- `POST /api/admin/returns/:returnId/decision`

## Frontend Surfaces

- Admin dashboard
- Admin users
- Admin shops
- Admin products
- Admin orders
- Admin refunds
- Admin commissions
- Admin reports

## Edge Cases

- Payment webhook failed.
- Shipment delayed.
- Refund escalation.
- Product flagged.
- Shop suspended.
- User role change conflict.

## Acceptance Criteria

- Admin pages are protected.
- Admin user management separates customer and system users.
- Admin order monitoring shows payment and shipment exceptions.
