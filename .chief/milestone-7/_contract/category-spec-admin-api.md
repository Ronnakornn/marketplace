# Contract: Admin Category Spec API

## Endpoints

Required admin endpoints:

- `GET /api/admin/categories/:categoryId/specs`
- `POST /api/admin/categories/:categoryId/specs`
- `PATCH /api/admin/categories/:categoryId/specs/:specId`
- `PATCH /api/admin/categories/:categoryId/specs/:specId/deactivate`
- `PATCH /api/admin/categories/:categoryId/specs/:specId/reactivate`
- `PUT /api/admin/categories/:categoryId/specs/reorder`

Public/seller endpoints:

- `GET /api/categories/:categoryId/specs`

## Spec Fields

Spec definitions support:

- `id`
- `categoryId`
- `attributeKey`
- `displayName`
- `displayNameTh`
- `displayNameEn`
- `type`
- `isRequired`
- `isFilterable`
- `unit`
- `sortOrder`
- `isActive`
- `createdAt`
- `updatedAt`

Implementation note:

- Existing Prisma `valueType` may be exposed as API `type`.
- Prisma schema must add `unit String?` and `isActive Boolean @default(true)` if they do not already exist.

## Rules

- Admin routes use `{ withRole: 'ADMIN' }`.
- `attributeKey` is normalized and unique per category.
- Spec records are never hard deleted in this milestone.
- Deactivate sets `isActive=false`.
- Reactivate sets `isActive=true`.
- Public/seller spec endpoints return active specs only, ordered by `sortOrder`.
- Admin spec endpoints can include inactive specs.
- Required active specs continue to be enforced during product submit-for-review.
- Inactive specs do not block submit-for-review.
- Historical `ProductAttribute` values remain untouched when specs are deactivated.
- Mutations invalidate category/spec, product-list, discovery, and search caches affected by spec/filter visibility.

## Out of Scope

- Enum/range/regex validation rules.
- Unit conversion.
- Automatic product attribute migration.
- Seller spec request workflow.
