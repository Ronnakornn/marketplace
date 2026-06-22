# Task 4: Admin Category/Spec Mutation UI

## Goal

Turn `/admin/categories` into a working category/spec management workspace.

## Affected Areas

- `app/features/catalog/components/AdminCategorySpecsManager.tsx`
- `app/features/catalog/hooks/useCatalog.ts`
- `app/features/catalog/components/AdminCategorySpecsManager.test.tsx`
- admin category route file if needed

## Required Work

1. Replace disabled draft controls with working mutation forms.
2. Add frontend hooks for admin category/spec endpoints using Eden/TanStack Query.
3. UI supports:
   - category search/filter
   - active/inactive visibility
   - select category
   - create category
   - edit category
   - deactivate/reactivate category with confirmation
   - reorder sibling categories via numeric sort/order controls
   - list specs for selected category
   - create spec
   - edit spec
   - deactivate/reactivate spec with confirmation
   - reorder specs
4. Show loading, empty, error, forbidden, pending, success, and mutation error states.
5. Invalidate/refetch relevant queries after mutations.

## Out of Scope

- Drag-and-drop tree editor.
- Bulk import/export.
- Seller request UI.
- Product duplicate UI.

## Acceptance Criteria

- `/admin/categories` no longer says mutation APIs are unavailable.
- Admin can manage category/spec state from one page.
- Inactive categories/specs are visually distinct.
- Mutation forms are disabled only when invalid or pending.
- UI remains usable on desktop and tablet-width layouts.

## Verification

```bash
bunx tsc --noEmit
bun run test app/features/catalog/components/AdminCategorySpecsManager.test.tsx
```
