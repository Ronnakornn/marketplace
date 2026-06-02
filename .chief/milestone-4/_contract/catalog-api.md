# Contract: Catalog API

## Public Catalog

Existing public product list and detail endpoints remain compatible:

- `GET /api/products`
- `GET /api/products/:productId`
- `GET /api/catalog/products`
- `GET /api/catalog/products/:productId`

Response additions:

- variants include selected option values
- products include primary image and ordered images
- categories can include parent metadata when requested

Rules:

- Public endpoints return active products only.
- Public endpoints do not expose seller-only moderation or inventory internals.

## Seller Product Management

Required seller endpoints:

- `GET /api/seller/products`
- `POST /api/seller/products`
- `GET /api/seller/products/:productId`
- `PATCH /api/seller/products/:productId`
- `DELETE /api/seller/products/:productId`
- `POST /api/seller/products/:productId/submit-review`

Rules:

- Seller routes use `{ withAuth: true }`.
- Services must enforce active shop ownership through existing shop ownership guards.
- Creating a product starts as `DRAFT`.
- Submit review changes status from `DRAFT` or `REJECTED` to `PENDING_REVIEW` only when publish readiness passes.

## Seller Variant Matrix

Required seller endpoints:

- `PUT /api/seller/products/:productId/options`
- `POST /api/seller/products/:productId/variants`
- `PATCH /api/seller/products/:productId/variants/:variantId`
- `DELETE /api/seller/products/:productId/variants/:variantId`

Rules:

- Option replacement must validate existing variant references.
- Variant creation requires valid option value references when options exist.
- Duplicate SKU and duplicate option combinations are rejected.

## Product Media

Required seller endpoints:

- `POST /api/seller/products/:productId/images`
- `PATCH /api/seller/products/:productId/images/:imageId`
- `DELETE /api/seller/products/:productId/images/:imageId`
- `PUT /api/seller/products/:productId/images/order`
- `POST /api/seller/products/:productId/video`
- `DELETE /api/seller/products/:productId/video`

Rules:

- Product uploads must come from completed upload records owned by the actor unless actor is admin.
- Product images must use `PRODUCT_IMAGE`.
- Product video must use `PRODUCT_VIDEO`.
- A product has at most one primary image.

## Admin Moderation

Required admin endpoints:

- `GET /api/admin/catalog/products/moderation`
- `GET /api/admin/catalog/products/:productId`
- `PATCH /api/admin/catalog/products/:productId/approve`
- `PATCH /api/admin/catalog/products/:productId/reject`
- `PATCH /api/admin/catalog/products/:productId/suspend`
- `PATCH /api/admin/catalog/products/:productId/restore`

Rules:

- Admin routes use `{ withRole: 'ADMIN' }`.
- Reject and suspend require a reason.
- Admin actions create moderation/audit records.
