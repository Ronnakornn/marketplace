# Task 2: Admin Category Mutation API

## Goal

Implement admin category mutation service/routes while preserving active-only public/seller category behavior.

## Affected Areas

- `server/modules/catalog/catalog.service.ts`
- `server/modules/catalog/catalog.routes.ts`
- `server/modules/catalog/catalog.repository.ts`
- `server/modules/catalog/catalog.service.test.ts`
- route tests if route coverage exists or is added
- cache invalidation helpers if needed

## Required Work

1. Implement service methods for:
   - create category
   - update category
   - deactivate category
   - reactivate category
   - reorder sibling categories
2. Add admin routes:
   - `GET /api/admin/categories`
   - `POST /api/admin/categories`
   - `PATCH /api/admin/categories/:categoryId`
   - `PATCH /api/admin/categories/:categoryId/deactivate`
   - `PATCH /api/admin/categories/:categoryId/reactivate`
   - `PUT /api/admin/categories/reorder`
3. Validate:
   - admin-only access using `{ withRole: 'ADMIN' }`
   - normalized unique slug
   - parent exists when provided
   - parent cycle rejection
   - sibling-only reorder
4. Preserve:
   - active-only public category reads
   - existing product category references after deactivate
5. Invalidate category/catalog/discovery/search caches affected by mutations.

## Out of Scope

- Spec mutation endpoints.
- Admin UI.
- Hard delete.

## Acceptance Criteria

- Admin can mutate category records through API.
- Public/seller category endpoints hide inactive categories.
- Deactivated categories remain visible in admin list.
- Existing products are not detached on deactivate.

## Verification

```bash
bunx tsc --noEmit
bun run test server/modules/catalog/catalog.service.test.ts
```

Add focused route tests for admin authorization and mutation payload validation.
