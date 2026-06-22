# Contract: Admin Category/Spec UI

## Page

Required page:

- `/admin/categories`

## Required Behavior

The page must support:

- category search/filter
- active/inactive visibility
- select category
- create category
- edit category fields
- deactivate/reactivate category
- reorder categories within the same parent
- view specs for selected category
- create spec
- edit spec fields
- deactivate/reactivate spec
- reorder specs within selected category

## UI Rules

- Use Eden Treaty inferred types.
- Use TanStack Query for server state.
- Keep feature code under `app/features/catalog`.
- Do not place catalog business logic in shared UI.
- Show loading, empty, error, forbidden, mutation pending, success, and mutation error states.
- Mutation controls are enabled when valid and disabled when pending or invalid.
- Deactivate actions require confirmation.
- Soft-deactivated categories/specs remain visible to admin with clear inactive status.
- Public/seller category/spec lists must not expose inactive records.

## Out of Scope

- Drag-and-drop tree editor.
- Bulk import/export.
- Seller request UI.
- Product duplicate workflow UI.
