# task-30: Split seller product pages

## Goal

Replace the dialog-heavy seller product workflow with dedicated list, create, and edit pages that are usable on mobile and desktop.

## Scope

- Keep `/seller/products` as the product list page.
- Add `/seller/products/create`.
- Add `/seller/products/[productId]/edit`.
- Move product create/edit from large dialogs into page-level forms.
- Preserve search, status filter, sorting/pagination, row actions, archive confirmation, loading state, empty state, and retry state on the list page.
- Use existing seller shell/navigation and route guard behavior.
- Ensure mobile layouts avoid horizontal overflow except where a table explicitly uses scroll.

## Affected Areas

- `app/[locale]/seller/products/page.tsx`
- new `app/[locale]/seller/products/create/page.tsx`
- new `app/[locale]/seller/products/[productId]/edit/page.tsx`
- `app/features/seller/components/SellerManagePages.tsx`
- new or extracted seller product form/list components under `app/features/seller/components/`
- seller product component tests

## Implementation Notes

- Prefer extracting product list and product form components rather than growing `SellerManagePages.tsx` further.
- List row actions should use links to create/edit routes, not open product edit dialogs.
- Keep archive and destructive actions confirmable.
- Page-level forms should use stable responsive sections for media, basic info, category/brand, variants, stock, dimensions, highlights, and attributes.
- Dirty-form protection is limited to explicit in-app cancel/back actions where practical; do not add browser navigation guards.
- Maintain accessible labels, visible errors, and icon button names.

## Verification

- Add/update component tests for:
  - list renders and links to create/edit
  - archive confirmation
  - create/edit form shell renders key sections
  - page-level load error retry state
  - mobile-friendly controls where practical
- Run:
  - `bunx tsc --noEmit`
  - focused seller product component tests
