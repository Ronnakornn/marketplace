# Seller Product CRUD Goal

## Objective

Make seller product management a complete seller-facing product workspace for product, media, variant, and initial stock setup, including production-grade catalog fields needed for sellable marketplace listings.

## Scope

- Split seller product management into dedicated App Router pages:
  - `/seller/products` for product list management
  - `/seller/products/create` for creating a product
  - `/seller/products/[productId]/edit` for editing a product
- Build product list management on `/seller/products` for:
  - search, status filtering, sorting, pagination, and row actions
  - create product
  - edit product
  - archive product
- Build variant management in the same workflow for:
  - create variant
  - edit variant
  - delete variant
- Build product media management in the create/edit page workflow using the existing `server/modules/upload` local/module upload system:
  - upload and manage up to 10 product images
  - upload and manage up to 1 product video
  - keep upload integration replaceable by a later cloud storage backend
- Allow sellers to set simple stock values for each variant inside product create/edit:
  - editable `quantityOnHand`
  - editable `reorderLevel`
  - read-only `quantityReserved`
  - read-only available stock
- Introduce a reusable default data table component under shared UI so future project tables can use the same TanStack Table + shadcn table pattern.
- Extend product catalog schema and APIs for production listing data:
  - category selection
  - product images as managed URL/metadata records
  - admin-managed brand selection
  - variant weight and dimensions in normalized base units
- Keep full inventory management on `/seller/inventory`; seller product create/edit may support initial/simple per-variant stock editing but must not become the primary bulk inventory operations workspace.
- Harden the `/seller/products` experience for production readiness while preserving marketplace ownership and publication rules.

## Success Criteria

- Sellers can manage product and variant records from the seller product list/create/edit pages without relying on inline one-off forms or oversized mobile-hostile dialogs.
- Product removal is presented as archive, not hard delete.
- Sellers can upload product images and video through the local/module upload flow and attach completed uploads to product media.
- Product images are limited to 10 per product.
- Product video is limited to 1 per product.
- The reusable data table is generic enough for other project screens but proven through `/seller/products` first.
- CRUD mutations provide clear success/error feedback, close completed dialogs, and refresh seller product data through TanStack Query invalidation.
- Product create/edit page forms protect unsaved edits where practical before destructive navigation or cancel actions.
- Table, form, media upload, variant, stock, and action states remain usable on desktop and mobile/tablet viewports.
- Page labels, form errors, icon buttons, and table loading/empty states meet practical accessibility expectations.
- Load failures provide a retry path, and mutation failures preserve user-entered form data.
- Product drafts can be created without category, images, or publish readiness fields.
- Publishing or updating a product to `ACTIVE` requires category, at least one product image, and at least one active variant with price greater than zero.
- Sellers can select an admin-managed brand or leave brand empty.
- Variant dimensions and weight are captured as normalized integer base units suitable for future shipping calculations.
- Variant stock setup in product create/edit never allows sellers to directly edit reserved stock.

## Out of Scope

- Bulk actions across many products.
- Refactoring every existing project table to the new reusable data table.
- Hard deleting product records that may be connected to orders, variants, reviews, or snapshots.
- Browser-level navigation guards for dirty forms.
- S3/CDN upload orchestration.
- Bulk media editing.
- Multiple product videos per product.
- Seller-created brand moderation workflows.
- Full admin brand CRUD UI.
- Shipping rate calculation from dimensions.

## Verification Goal

- Add focused component tests for the reusable data table behavior used by this milestone.
- Add focused component tests for seller product CRUD interactions where practical.
- Include coverage for production readiness behavior where practical, such as dirty dialog close, retry/error state, and accessible action labels.
- Add backend tests for catalog schema/API behavior that changes, including publish readiness validation and seller ownership preservation.
- Add backend tests for product media upload attachment behavior, media limits, media ownership, and video validation.
- Run Prisma generation after schema changes before typecheck/tests.
- Run `bunx tsc --noEmit`.
