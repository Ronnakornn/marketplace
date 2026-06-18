# Contract: Category API

## Public Categories

Required endpoints:

- `GET /api/categories`
- `GET /api/categories/tree`
- `GET /api/categories/:categoryId/specs`

Rules:

- Public category endpoints return active categories only.
- Tree endpoint returns parent-child hierarchy ordered by `sortOrder`.

## Admin Categories

Required endpoints:

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:categoryId`
- `DELETE /api/admin/categories/:categoryId`
- `PUT /api/admin/categories/:categoryId/specs`

Rules:

- Admin routes use `{ withRole: 'ADMIN' }`.
- Category delete is blocked when active products still reference the category.
- Category spec keys must be unique per category.
- Required specs are validated during product submit-for-review.
