# API Contracts

This document defines practical API contracts for the marketplace frontend and backend. Request and response shapes should be implemented with Elysia, TypeBox/Prismabox, Prisma, Eden Treaty, and TanStack Query.

## Contract Rules

- Browser calls use same-origin `/api/*`.
- Frontend types are inferred from Eden Treaty; do not duplicate response types manually.
- Money values use integer cents.
- IDs are UUID strings unless explicitly documented otherwise.
- Timestamps are ISO strings.
- Lists use cursor pagination.
- Errors use stable `error.code` values.
- Trusted price, stock, payment, and shipment state must come from the backend.

## Shared Shapes

### Success

```json
{
  "data": {},
  "meta": {}
}
```

### Error

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Pagination Meta

```json
{
  "nextCursor": "uuid-or-null",
  "hasNextPage": true
}
```

## Catalog

### `GET /api/catalog/products`

Used by home feed, search results, category pages, and deals.

Query:
- `q`
- `categoryId`
- `shopId`
- `status`
- `minPriceCents`
- `maxPriceCents`
- `rating`
- `sort`
- `cursor`
- `limit`
- `locale` (`th` or `en`, defaults to `th`)

Response data:
- product id, slug, localized title
- localized description when present
- primary image
- price range in cents
- currency
- discount or campaign badge
- rating summary
- sold count
- shop summary
- free shipping flag
- stock hint

Errors:
- `CATALOG_QUERY_INVALID`

### `GET /api/catalog/products/:productId`

Used by product detail.

Query:
- `locale` (`th` or `en`, defaults to `th`)

Response data:
- product detail
- images
- variants with localized title
- inventory availability
- shop card
- shipping options
- review summary
- related products

Errors:
- `PRODUCT_NOT_FOUND`
- `PRODUCT_UNAVAILABLE`

### `GET /api/categories`

Query:
- `locale` (`th` or `en`, defaults to `th`)

Response data:
- category id, slug, localized name
- icon/image
- parent id
- sort order
- active state

## Search

### `GET /api/search/suggestions`

Query:
- `q`

Response data:
- keyword suggestions
- matching categories
- matching shops

Errors:
- `SEARCH_QUERY_INVALID`

## Cart

### `GET /api/cart`

Response data:
- shop groups
- cart items
- selected state
- item availability
- quantity
- estimated shipping
- shop vouchers
- selected total

Errors:
- `CART_NOT_FOUND`

### `POST /api/cart/items`

Body:
- `variantId`
- `quantity`

Behavior:
- Validates product and variant availability.
- Does not reserve final stock.

Errors:
- `VARIANT_NOT_FOUND`
- `PRODUCT_UNAVAILABLE`
- `CART_QUANTITY_INVALID`

### `PATCH /api/cart/items/:itemId`

Body:
- `quantity`
- `selected`

Errors:
- `CART_ITEM_NOT_FOUND`
- `CART_QUANTITY_INVALID`

### `DELETE /api/cart/items/:itemId`

Behavior:
- Removes item from buyer cart.

Errors:
- `CART_ITEM_NOT_FOUND`

## Checkout

## Promotion

### `GET /api/coupons`

Query:
- `locale` (`th` or `en`, defaults to `th`)

Response data:
- coupon code and discount fields
- localized title and description for voucher/deal displays
- minimum order, max discount, and end date when present

Behavior:
- Returns active public coupons.
- Coupon validation still uses `code`; localized display content does not affect discount calculation.

### `POST /api/checkout`

Body:
- selected cart item ids, or
- direct buy variant id and quantity

Behavior:
- Validates buyer context.
- Groups items by shop.
- Creates checkout draft.

Errors:
- `CHECKOUT_ITEMS_REQUIRED`
- `CHECKOUT_ITEM_UNAVAILABLE`

### `PATCH /api/checkout/:checkoutId`

Body:
- address id
- shipping selections per shop
- coupon codes
- payment method

Behavior:
- Recalculates totals from trusted backend data.

Errors:
- `CHECKOUT_NOT_FOUND`
- `CHECKOUT_ADDRESS_REQUIRED`
- `CHECKOUT_SHIPPING_INVALID`
- `COUPON_NOT_APPLICABLE`

### `POST /api/checkout/:checkoutId/reserve`

Behavior:
- Reserves inventory for checkout items with expiry.
- Returns per-item stock errors if reservation fails.

Errors:
- `CHECKOUT_NOT_FOUND`
- `CHECKOUT_STOCK_UNAVAILABLE`
- `CHECKOUT_EXPIRED`

### `POST /api/checkout/:checkoutId/place-order`

Behavior:
- Requires successful reservation.
- Creates pending order.
- Creates or returns payment intent.

Errors:
- `CHECKOUT_NOT_RESERVED`
- `CHECKOUT_TOTAL_CHANGED`
- `PAYMENT_INTENT_FAILED`

## Payment

### `POST /api/payments/:orderId/intent`

Behavior:
- Creates or reuses payment intent/session.
- Does not mark payment success.

Errors:
- `ORDER_NOT_FOUND`
- `ORDER_NOT_PAYABLE`
- `PAYMENT_INTENT_FAILED`

### `POST /api/payments/webhook`

Caller:
- Payment gateway.

Behavior:
- Verifies provider signature.
- Uses provider event id for idempotency.
- Only trusted path to mark payment succeeded.
- On success: mark payment succeeded, mark order paid, commit reserved stock, create shipments by shop.
- On failure/cancel: mark payment failed and release reservation.

Errors:
- `WEBHOOK_SIGNATURE_INVALID`
- `WEBHOOK_EVENT_DUPLICATE`
- `PAYMENT_EVENT_INVALID`

### `GET /api/orders/:orderId/payment-status`

Response data:
- order id
- payment status
- order status
- next action

Used by:
- payment return polling.

## Orders and Fulfillment

### `GET /api/orders`

Query:
- `status`
- `cursor`
- `limit`

Response data:
- buyer order cards
- order status
- payment status
- shipment summary
- total cents

### `GET /api/orders/:orderId`

Response data:
- order status
- payment status
- shop-grouped order items
- item snapshots
- address snapshot
- shipment cards by shop
- tracking timeline
- review eligibility
- return/refund eligibility

Errors:
- `ORDER_NOT_FOUND`
- `ORDER_FORBIDDEN`

### `GET /api/seller/shipments`

Query:
- `status`
- `dateFrom`
- `dateTo`
- `cursor`
- `limit`

Response data:
- seller-owned shipment queue.

Errors:
- `SELLER_SHOP_REQUIRED`

### `POST /api/seller/shipments/:shipmentId/ship`

Body:
- carrier
- tracking number
- shipped item quantities

Behavior:
- Seller can only ship own shop shipment.

Errors:
- `SHIPMENT_NOT_FOUND`
- `SHIPMENT_FORBIDDEN`
- `SHIPMENT_TRACKING_REQUIRED`
- `SHIPMENT_STATUS_INVALID`

### `POST /api/shipping/webhook`

Caller:
- Shipping provider.

Behavior:
- Updates tracking and delivery events.

Errors:
- `WEBHOOK_SIGNATURE_INVALID`
- `SHIPMENT_EVENT_INVALID`

## Reviews

### `POST /api/orders/:orderId/reviews`

Body:
- order item id
- rating
- body
- image references

Errors:
- `REVIEW_NOT_ELIGIBLE`
- `REVIEW_ALREADY_EXISTS`

### `GET /api/products/:productId/reviews`

Query:
- rating
- cursor
- limit

Response data:
- review summary
- review list

## Returns and Refunds

### `POST /api/orders/:orderId/returns`

Body:
- order item ids
- quantities
- reason
- evidence references
- notes

Errors:
- `RETURN_NOT_ELIGIBLE`
- `RETURN_QUANTITY_INVALID`

### `GET /api/returns/:returnId`

Response data:
- return status
- required actions
- evidence
- refund status

### `POST /api/admin/returns/:returnId/decision`

Body:
- decision
- reason
- refund amount cents

Errors:
- `RETURN_NOT_FOUND`
- `RETURN_DECISION_INVALID`

### `POST /api/refunds/:refundId/process`

Behavior:
- Sends refund request to payment provider.
- Refund completion must be provider-confirmed.

Errors:
- `REFUND_NOT_FOUND`
- `REFUND_PROVIDER_FAILED`

## Seller

### `GET /api/seller/dashboard`

Response data:
- pending shipments
- low-stock variants
- active promotions
- unread chats
- finance summary

### `GET /api/seller/products`

Response data:
- seller-owned products
- variants and inventory summary
- moderation status

### `POST /api/seller/products`

Behavior:
- Creates product and variants for seller shop.

Errors:
- `SELLER_SHOP_REQUIRED`
- `PRODUCT_VALIDATION_FAILED`

### `PATCH /api/seller/products/:productId`

Behavior:
- Updates seller-owned product.

Errors:
- `PRODUCT_NOT_FOUND`
- `PRODUCT_FORBIDDEN`

### `PATCH /api/seller/variants/:variantId/inventory`

Behavior:
- Updates inventory fields for seller-owned variant.

Errors:
- `VARIANT_NOT_FOUND`
- `VARIANT_FORBIDDEN`
- `INVENTORY_VALIDATION_FAILED`

## Admin

### `GET /api/admin/dashboard`

Response data:
- operational metrics
- exception queues
- moderation counts

### `GET /api/admin/users`

Response data:
- customer users
- system users
- role and status

### `GET /api/admin/shops`

Query:
- status

### `PATCH /api/admin/shops/:shopId/status`

Body:
- status
- reason

### `GET /api/admin/products/moderation`

Response data:
- flagged products
- pending products

### `PATCH /api/admin/products/:productId/moderation`

Body:
- decision
- reason

### `GET /api/admin/orders`

Query:
- q
- status
- paymentStatus
- shipmentStatus
- cursor
- limit

### `GET /api/admin/reports`

Query:
- date range
- report type

## Status Codes

- `200` success
- `201` created
- `204` deleted/no content
- `400` validation or invalid state
- `401` unauthenticated
- `403` unauthorized
- `404` not found
- `409` conflict or duplicate event
- `422` business rule failed
- `500` unexpected server error
