# Contract: Admin Category API

## Endpoints

Required admin endpoints:

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:categoryId`
- `PATCH /api/admin/categories/:categoryId/deactivate`
- `PATCH /api/admin/categories/:categoryId/reactivate`
- `PUT /api/admin/categories/reorder`

Public/seller endpoints remain read-only and active-only:

- `GET /api/categories`
- `GET /api/categories/tree`
- `GET /api/categories/:categoryId/specs`

## Category Fields

Admin category responses include:

- `id`
- `parentId`
- `name`
- `nameTh`
- `nameEn`
- `slug`
- `sortOrder`
- `isActive`
- `createdAt`
- `updatedAt`
- child counts or product counts when cheap and already available

## Rules

- Admin routes use `{ withRole: 'ADMIN' }`.
- Category records are never hard deleted in this milestone.
- Deactivate sets `isActive=false`.
- Reactivate sets `isActive=true`.
- Public and seller assignment endpoints return active categories only.
- Admin list can include active and inactive categories.
- Reorder only updates sibling `sortOrder` values.
- Parent changes must reject cycles.
- Slugs are unique, normalized, and non-empty.
- Deactivating a category with products is allowed, but it must not detach existing product references.
- Mutations invalidate category, product-list, discovery, and search caches affected by category visibility/order.

## Out of Scope

- Seller category request workflow.
- Hard delete.
- Full drag-and-drop tree editor.
- Product multi-category assignment.
