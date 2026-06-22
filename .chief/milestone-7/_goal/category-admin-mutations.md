# Goal: Category Admin Mutations

## Outcome

Admins can create, edit, deactivate, reactivate, and reorder marketplace categories from the backoffice.

## Scope

- Admin-only category management.
- Create and update category name, localized names, slug, parent, active status, and sibling `sortOrder`.
- Soft deactivate categories instead of hard deleting records.
- Keep public and seller category selection limited to active categories.
- Preserve existing product category references when categories are deactivated.

## Out of Scope

- Seller category request workflow.
- Hard delete of category records.
- Full drag-and-drop tree restructuring.
- Product multi-category assignment.
- Product duplicate or quality workflow.

## Success Criteria

- Admin APIs can mutate category records with `{ withRole: 'ADMIN' }`.
- Deactivated categories disappear from public/seller assignment lists.
- Existing products referencing inactive categories remain readable in admin/seller contexts.
- Reordering siblings updates deterministic category display order.
- Category mutations invalidate category/catalog/discovery caches where applicable.
