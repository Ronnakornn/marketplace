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

- `User.role` has no `SELLER` value. Seller access is scoped to an authenticated user's active owned shop or active shop-staff membership.
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
- `POST /api/seller/products/:productId/publish`
- `PATCH /api/seller/variants/:variantId/inventory`
- `GET /api/seller/shipments`
- `POST /api/seller/shipments/:shipmentId/ship`
- `GET /api/seller/finance`
- `GET /api/seller/promotions`
- `GET|POST /api/seller/shops/:shopId/staff`
- `PATCH|DELETE /api/seller/shops/:shopId/staff/:staffId`
- `GET /api/seller/staff/invitations`
- `POST /api/seller/staff/invitations/:staffId/accept`

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
- Product suspended by admin after publication.
- Low stock with reserved inventory.
- Shipment canceled/refunded.

## Shop Staff

- Only an active shop owner can invite, change, suspend, or remove staff.
- Invites target an existing platform account. Account accepts from profile before membership becomes active.
- Presets: Manager (`products`, `inventory`, `shipments`, `promotions`, `chat`), Fulfillment (`inventory`, `shipments`), Support (`chat`, `returns`).
- Staff access is one-shop scoped; invite/update/remove create `ShopActivityLog` entries.
- Shipment list, pack, and ship require `shipments` permission for staff.

## Acceptance Criteria

- Seller pages enforce shop ownership.
- Dashboard highlights pending shipments and low stock.
- Shipment processing requires carrier and tracking number.
