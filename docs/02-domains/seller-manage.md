# Seller Manage

Seller manage is the shop-scoped backoffice for sellers. It covers daily operations for products, inventory, shipments, returns, promotions, finance, chat, and notifications.

## Navigation

- `/seller` - operational dashboard
- `/seller/register` - shop onboarding and Thailand KYC submission
- `/seller/status` - pending/rejected seller application status
- `/seller/products` - product and variant management
- `/seller/inventory` - stock and reserved inventory
- `/seller/orders` - shipment-based order processing
- `/seller/returns` - seller return review
- `/seller/promotions` - shop coupons and campaigns
- `/seller/finance` - wallet, ledger, and payouts
- `/seller/chat` - buyer conversations
- `/seller/notifications` - seller notifications

## Ownership Rules

- Seller onboarding APIs use `{ withAuth: true }`.
- Seller operational APIs use `{ withAuth: true }` and must resolve an `ACTIVE` shop owned by the authenticated user.
- `User.role` only contains platform roles (`USER`, `ADMIN`). Seller access is based on `SellerProfile`, `Shop.ownerId`, active shop status, and future `ShopStaff` permissions.
- Sellers can only access resources for shops where `Shop.ownerId` is the seller user id.
- Multi-shop support is bounded by `SellerProfile.maxShopCount`; v1 UI may default to the primary/selected active shop.
- Pending or rejected applications can only access onboarding/status surfaces.
- Seller order processing is shipment-based. A seller cannot mutate the whole buyer order.
- Sellers cannot mark payment success, alter order snapshots, or edit reserved stock directly.
- Inventory changes must preserve `quantityReserved` and update only allowed stock fields.

## Onboarding

- Uses `GET /api/seller/application`.
- Uses `POST /api/seller/application/draft` to save shop, KYC, pickup address, bank, and document state.
- Uses `POST /api/seller/application/submit` to validate required documents and create or update a `PENDING` shop.
- Admin review uses `/api/admin/seller-applications` and `/api/admin/seller-applications/:applicationId/review`.
- Approval sets the application to `APPROVED`, shop to `ACTIVE`, and creates the seller wallet if missing.
- Approval must also ensure a `SellerProfile` exists, link `Shop.sellerProfileId`, and create or update pickup/return `ShopAddress` records where applicable.
- Rejection stores a reason and keeps seller operations locked until resubmission and approval.
- Thai ID, tax ID, company registration, and bank account number must be encrypted at rest and only masked values may be returned to clients.
- KYC documents must be completed uploads owned by the application user with `KYC_DOCUMENT` usage.

## Page Responsibilities

### Dashboard

- Uses `GET /api/seller/dashboard`.
- Shows sales, pending shipments, product counts, low-stock items, recent orders, and entry points to chat/notifications.
- Primary actions should route to orders and inventory.

### Products

- Uses seller catalog APIs under `/api/seller/products`.
- Supports list, search, status filters, create/edit product, publish/archive product, and variant create/edit/delete.
- A seller may publish a complete draft directly; admin product approval is not required.
- A seller cannot publish an admin-suspended product.

### Inventory

- Reads variant inventory from seller product responses.
- Uses `PATCH /api/seller/variants/:variantId/inventory` to update stock.
- Shows on-hand, reserved, available, reorder level, and low-stock state.

### Orders And Shipments

- Uses `/api/seller/shipments`.
- Shows shipments with order number, shipping address, items, carrier/tracking, and status.
- Supports pack, ship, and deliver transitions.
- Shipping requires carrier and tracking number.

### Returns

- Uses `/api/seller/returns`.
- Shows buyer reason, description/images, order item snapshots, and refund status.
- Seller can approve/reject requested returns only.

### Promotions

- Uses seller coupon APIs under `/api/seller/coupons`.
- Coupons are always scoped to the seller shop.
- Supports create, update, activate/deactivate, and delete.

### Finance

- Uses `/api/seller/wallet`, `/api/seller/wallet/transactions`, and `/api/seller/payouts`.
- Shows available balance, ledger entries, payout request form, and payout history.
- Payout request must be positive cents and cannot exceed available balance.

## State Requirements

- Every page must render loading, error, empty, and success states.
- Mutations must show pending state and invalidate relevant seller query keys.
- Mobile UI should use stacked operational cards; desktop can use dense tables.

## Implementation Order

1. Seller shell and dashboard
2. Products and variants
3. Inventory
4. Orders and shipments
5. Returns
6. Promotions
7. Finance and payouts
8. Chat and notifications polish

## Acceptance Criteria

- Seller operational pages are active-shop protected.
- Buyer accounts can onboard as sellers and still use cart, checkout, buyer orders, reviews, returns, and buyer chat.
- Seller APIs reject cross-shop access.
- Dashboard highlights pending shipments and low stock.
- Inventory displays on-hand, reserved, available, and reorder level.
- Shipment processing requires valid carrier/tracking.
- Seller coupons cannot affect another shop.
- Finance page shows trusted wallet state from the backend.
