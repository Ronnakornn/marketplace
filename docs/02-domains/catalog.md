# Catalog Domain

The Catalog domain owns product discovery and seller product content.

## Responsibilities

- Products
- Product variants
- Product images/media references
- Categories
- Shop product ownership
- Product publication status
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
- Sellers may publish complete drafts without admin approval.
- Publishing requires an active category, required category attributes, a primary image, and an active priced variant.
- Admins may suspend and restore published products after publication.
- Sellers cannot override an admin suspension.
- Product updates must not rewrite historical order item snapshots.

## Statuses

Product statuses:
- Draft
- Active
- Archived
- Suspended

`Pending Review` and `Rejected` are legacy statuses and are not seller-controlled lifecycle states.

## API Surface

- `GET /api/catalog/products`
- `GET /api/catalog/products/:productId`
- `GET /api/categories`
- `GET /api/products/:productId/reviews`
- `GET /api/seller/products`
- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`
- `POST /api/seller/products/:productId/publish`
- `POST /api/seller/products/:productId/archive`
- `PATCH /api/admin/catalog/products/:productId/suspend`
- `PATCH /api/admin/catalog/products/:productId/restore`

## Frontend Surfaces

- Marketplace home
- Search results
- Category product list
- Deals feed
- Product detail
- Seller product management
- Admin product oversight

## Edge Cases

- Product archived while in cart.
- Variant out of stock.
- Product suspended after publication.
- Shop suspended.
- Price changed before checkout.

## Acceptance Criteria

- Buyers only see public active products.
- Sellers only manage their own products.
- Admins can inspect, suspend, and restore products.
- Product detail exposes variants and inventory availability.
- Order history uses snapshots, not current product fields.
