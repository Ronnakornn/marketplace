# Seller Domain

The Seller domain owns shop onboarding, seller profile verification, and seller-facing operations for shops, products, inventory, shipments, promotions, finance summaries, and chat.

Detailed seller manage implementation rules live in [seller-manage.md](seller-manage.md).

## Responsibilities

- Seller dashboard
- Seller profile and shop onboarding
- KYC application review state
- Shop staff and permission foundation
- Shop-scoped product management
- Inventory management
- Shipment processing
- Promotion management
- Finance summary
- Seller chat inbox

## Business Rules

- `User.role` has no `SELLER` value. Seller access is scoped to an authenticated user's seller profile and active owned shops.
- A user can remain a buyer and become a seller after shop onboarding and admin approval.
- Operational seller APIs require an `ACTIVE` shop. `PENDING`, `REJECTED`, `BANNED`, `SUSPENDED`, and `VACATION` shops cannot use full seller operations.
- Seller order processing is shipment-based, not whole-order based.
- Seller inventory edits must respect reserved stock.
- Seller cannot mark payment success.
- Seller cannot alter buyer order snapshots.

## API Surface

- `GET /api/seller/application`
- `POST /api/seller/application/draft`
- `POST /api/seller/application/submit`
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

- Seller registration
- Seller application status
- Seller dashboard
- Seller product management
- Seller inventory
- Seller order processing
- Seller finance
- Seller promotions
- Seller chat

## Edge Cases

- Shop verification pending.
- Seller application rejected and resubmitted.
- Buyer account has an active shop and still uses cart, checkout, orders, reviews, returns, and chat.
- User owns multiple shops within `SellerProfile.maxShopCount`.
- Shop staff account can manage only permitted shop surfaces.
- Shop suspended.
- Product rejected by moderation.
- Low stock with reserved inventory.
- Shipment canceled/refunded.

## Acceptance Criteria

- Seller pages enforce shop ownership.
- Dashboard highlights pending shipments and low stock.
- Shipment processing requires carrier and tracking number.
