# task-11: Rebuild `/seller/products` with production-ready product table, dialogs, and archive flow

## Goal

Replace the current inline seller products UI with a complete, production-ready product management table and product CRUD dialogs.

## Scope

- Update `SellerProductsPage` in `app/features/seller/components/SellerManagePages.tsx` or extract focused seller product components under `app/features/seller/components/`.
- Use the shared `DataTable` from task-9.
- Provide table columns for product management:
  - product title/slug
  - status
  - variant count
  - representative price/stock context where available from current response data
  - row actions
- Add toolbar controls:
  - search input
  - status filter
  - create product button
- Add product create/edit dialog or drawer.
- Add product archive confirmation using archive wording.
- Use only fields allowed by the seller product CRUD contract.
- Show mutation success/error feedback through existing project UI patterns.
- Close completed dialogs after successful mutation.
- Add page-level load error UI with a retry action.
- Preserve product form data when mutations fail.
- Add dirty-form protection when closing product create/edit dialogs with unsaved edits.
- Keep the table usable on mobile and tablet through horizontal scroll or equivalent responsive behavior.
- Ensure product dialogs have accessible labels/descriptions, product fields have labels, and icon-only actions have accessible names.
- Add basic client validation for required product fields.

## Out of Scope

- Do not hard delete products.
- Do not add image uploads, category assignment, or bulk actions.
- Do not refactor unrelated seller pages.
- Do not add browser-level navigation guards for dirty forms.
- Do not add publish readiness checklist or new backend validation rules for `ACTIVE` product status.

## Verification

- Add focused component tests for product create/edit/archive UI interactions where practical.
- Include tests for load retry, archive confirmation, dirty product dialog close, and accessible action labels where practical.
- Run focused seller product tests.
- Run `bunx tsc --noEmit`.
