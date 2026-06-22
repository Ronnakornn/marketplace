# Task 3: Admin Category Spec Mutation API

## Goal

Implement admin category spec mutation service/routes and enforce active required specs in publish readiness.

## Affected Areas

- `server/modules/catalog/catalog.service.ts`
- `server/modules/catalog/catalog.routes.ts`
- `server/modules/catalog/catalog.repository.ts`
- `server/modules/catalog/catalog.service.test.ts`
- route tests if route coverage exists or is added
- cache invalidation helpers if needed

## Required Work

1. Implement service methods for:
   - list specs for admin including inactive
   - create spec
   - update spec
   - deactivate spec
   - reactivate spec
   - reorder specs within a category
2. Add admin routes:
   - `GET /api/admin/categories/:categoryId/specs`
   - `POST /api/admin/categories/:categoryId/specs`
   - `PATCH /api/admin/categories/:categoryId/specs/:specId`
   - `PATCH /api/admin/categories/:categoryId/specs/:specId/deactivate`
   - `PATCH /api/admin/categories/:categoryId/specs/:specId/reactivate`
   - `PUT /api/admin/categories/:categoryId/specs/reorder`
3. Add or confirm public/seller spec route:
   - `GET /api/categories/:categoryId/specs`
4. Validate:
   - `attributeKey` normalized and unique per category
   - `displayName` non-empty
   - valid `type`/`valueType`
   - `unit` optional
   - reorder only within selected category
5. Publish readiness:
   - active required specs block missing product attributes
   - inactive required specs do not block review submission
6. Cache invalidation for specs/category/product discovery/search.

## Out of Scope

- Enum/range/regex validation rules.
- Product attribute migration.
- Admin UI.

## Acceptance Criteria

- Admin can mutate specs through API.
- Seller/public spec reads show active specs only.
- Required active spec enforcement is covered by tests.
- Inactive specs preserve historical product attributes.

## Verification

```bash
bunx tsc --noEmit
bun run test server/modules/catalog/catalog.service.test.ts
```

Add focused route tests for spec admin authorization and payload validation.
