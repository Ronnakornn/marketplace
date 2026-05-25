# task-12: Add production-ready variant create/edit/delete workflows inside seller product management

## Goal

Add complete, production-ready variant management workflows to `/seller/products` without moving inventory ownership away from `/seller/inventory`.

## Scope

- Add variant row actions or expandable product details within seller product management.
- Support:
  - create variant
  - edit variant
  - delete variant confirmation
- Variant forms include only contract-approved fields:
  - `sku`
  - `title`
  - `titleTh`
  - `titleEn`
  - `price`
  - `currency`
- Display existing inventory context if available, but do not make `/seller/products` the main inventory editor.
- Invalidate seller product queries after successful variant mutations.
- Keep dialogs/drawers scoped and accessible.
- Preserve variant form data when mutations fail.
- Add dirty-form protection when closing variant create/edit dialogs with unsaved edits.
- Add basic client validation for required variant fields and valid price input.
- Ensure variant delete requires explicit confirmation.
- Ensure variant action buttons have accessible names and are keyboard reachable.

## Out of Scope

- Do not add stock editing here beyond existing display context.
- Do not add product options/attributes/media.
- Do not add browser-level navigation guards for dirty forms.

## Verification

- Add focused component tests for variant create/edit/delete interactions where practical.
- Include tests for variant delete confirmation, dirty variant dialog close, mutation error preservation, and accessible action labels where practical.
- Run focused seller product tests.
- Run `bunx tsc --noEmit`.
