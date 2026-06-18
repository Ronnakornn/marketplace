# Goal: Admin Category/Spec UI

## Outcome

The `/admin/categories` page becomes a real mutation workspace instead of a read-only draft console.

## Scope

- Replace disabled draft controls with working create/edit/deactivate/reactivate/reorder flows.
- Show category tree/list with active and inactive states.
- Show selected category details and spec definition editor.
- Provide loading, empty, error, mutation pending, and success/error feedback states.
- Keep forms compact and operational for repeated admin use.

## Out of Scope

- Visual drag-and-drop tree editor.
- Bulk category import/export.
- Seller-facing category request UI.
- Duplicate product quality queue.

## Success Criteria

- Admin can manage categories and specs without leaving `/admin/categories`.
- UI uses Eden Treaty inferred types and TanStack Query.
- Mutation controls are disabled only for invalid/pending states, not because APIs are missing.
- Tests cover category mutation UI, spec mutation UI, and inactive state display.
