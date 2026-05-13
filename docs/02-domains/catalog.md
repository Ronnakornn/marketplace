# Catalog Domain

The Catalog domain owns product discovery and seller product content.

## Responsibilities

- Products
- Product variants
- Product images/media references
- Categories
- Shop product ownership
- Product status and moderation status
- Product listing/search read models

## Core Models

- Product
- ProductVariant
- Inventory
- Shop
- Category
- Review summary

## Business Rules

- Sellers can create and update products only for their own shop.
- Products can have multiple variants.
- Product cards must expose price in integer cents and currency.
- Product detail must show variant availability.
- Product status controls buyer visibility.
- Product moderation can prevent public listing.
- Product updates must not rewrite historical order item snapshots.

## Statuses

Product statuses:
- Draft
- Active
- Archived
- Rejected

Moderation statuses:
- Pending
- Approved
- Rejected
- Flagged

## API Surface

- `GET /api/catalog/products`
- `GET /api/catalog/products/:productId`
- `GET /api/categories`
- `GET /api/products/:productId/reviews`
- `GET /api/seller/products`
- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`
- `GET /api/admin/products/moderation`
- `PATCH /api/admin/products/:productId/moderation`

## Frontend Surfaces

- Marketplace home
- Search results
- Category product list
- Deals feed
- Product detail
- Seller product management
- Admin product moderation

## Edge Cases

- Product archived while in cart.
- Variant out of stock.
- Product rejected by moderation.
- Shop suspended.
- Price changed before checkout.

## Acceptance Criteria

- Buyers only see public active products.
- Sellers only manage their own products.
- Admins can inspect and moderate products.
- Product detail exposes variants and inventory availability.
- Order history uses snapshots, not current product fields.
