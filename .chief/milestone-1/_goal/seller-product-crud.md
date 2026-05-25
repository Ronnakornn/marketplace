# Seller Product CRUD Goal

## Objective

Make `/seller/products` a complete seller-facing product management workspace for product and variant CRUD, including production-grade catalog fields needed for sellable marketplace listings.

## Scope

- Build product list management on `/seller/products` for:
  - search, status filtering, sorting, pagination, and row actions
  - create product
  - edit product
  - archive product
- Build variant management in the same workflow for:
  - create variant
  - edit variant
  - delete variant
- Introduce a reusable default data table component under shared UI so future project tables can use the same TanStack Table + shadcn table pattern.
- Extend product catalog schema and APIs for production listing data:
  - category selection
  - product images as managed URL/metadata records
  - admin-managed brand selection
  - variant weight and dimensions in normalized base units
- Keep full inventory management on `/seller/inventory`; `/seller/products` may show variant stock context but must not become the primary inventory editor.
- Harden the `/seller/products` experience for production readiness while preserving marketplace ownership and publication rules.

## Success Criteria

- Sellers can manage product and variant records from `/seller/products` without relying on inline one-off forms.
- Product removal is presented as archive, not hard delete.
- The reusable data table is generic enough for other project screens but proven through `/seller/products` first.
- CRUD mutations provide clear success/error feedback, close completed dialogs, and refresh seller product data through TanStack Query invalidation.
- Product and variant dialogs protect unsaved edits when the user attempts to close them.
- Table, dialog, form, and action states remain usable on desktop and mobile/tablet viewports.
- Dialog labels, form errors, icon buttons, and table loading/empty states meet practical accessibility expectations.
- Load failures provide a retry path, and mutation failures preserve user-entered form data.
- Product drafts can be created without category, images, or publish readiness fields.
- Publishing or updating a product to `ACTIVE` requires category, at least one product image, and at least one active variant with price greater than zero.
- Sellers can select an admin-managed brand or leave brand empty.
- Variant dimensions and weight are captured as normalized integer base units suitable for future shipping calculations.

## Out of Scope

- Bulk actions across many products.
- Refactoring every existing project table to the new reusable data table.
- Hard deleting product records that may be connected to orders, variants, reviews, or snapshots.
- Browser-level navigation guards for dirty forms.
- Product image binary upload endpoints, presigned upload flows, or S3/CDN upload orchestration.
- Seller-created brand moderation workflows.
- Full admin brand CRUD UI.
- Shipping rate calculation from dimensions.

## Verification Goal

- Add focused component tests for the reusable data table behavior used by this milestone.
- Add focused component tests for seller product CRUD interactions where practical.
- Include coverage for production readiness behavior where practical, such as dirty dialog close, retry/error state, and accessible action labels.
- Add backend tests for catalog schema/API behavior that changes, including publish readiness validation and seller ownership preservation.
- Run Prisma generation after schema changes before typecheck/tests.
- Run `bunx tsc --noEmit`.
