# Seller Product CRUD Contract

## Route and Access Contract

- `/seller/products` remains a protected operational seller route.
- Route access must continue to use the existing seller route guard and seller access rules.
- Product and variant data shown on `/seller/products` must remain scoped to the authenticated seller's shop ownership.
- Seller product CRUD must not rely on a `SELLER` user role when existing seller access is based on active shop ownership/application state.

## API Compatibility Contract

- Extend existing seller catalog endpoints where possible:
  - `GET /api/seller/products`
  - `POST /api/seller/products`
  - `PATCH /api/seller/products/:productId`
  - `DELETE /api/seller/products/:productId`
  - `POST /api/seller/products/:productId/variants`
  - `PATCH /api/seller/products/:productId/variants/:variantId`
  - `DELETE /api/seller/products/:productId/variants/:variantId`
- Add catalog endpoints only where the current shape cannot represent the new resource cleanly, such as product image create/update/delete and brand list/admin management.
- Existing endpoint response shapes may be extended with optional/new fields but must remain backward compatible for current Eden/Treaty inferred frontend consumers.
- Product delete UI must call the existing archive behavior and present it as archive, not hard delete.
- Variant delete may call the existing variant delete endpoint.
- Frontend request/response types must stay inferred from the existing API client or local hook types derived from it; do not manually duplicate backend response DTOs.
- Backend validation must continue to use TypeBox/Prismabox patterns if route validation changes are required.

## Schema Contract

- Add a `Brand` model for global admin-managed brand master data.
- Product records may reference `Brand` through nullable `brandId`.
- Brand records must support active/inactive state and stable lookup for seller product forms.
- Add a `ProductImage` model for product image URL/metadata records.
- `ProductImage` must support:
  - `productId`
  - `url`
  - `altText`
  - `sortOrder`
  - `isPrimary`
  - `width`
  - `height`
  - timestamps
- Product images must remain owned through their product and seller shop scope.
- Add normalized integer shipping fields to `ProductVariant`:
  - `weightGrams`
  - `lengthMm`
  - `widthMm`
  - `heightMm`
- Dimension and weight fields should be nullable unless a later shipping contract requires them.
- Add indexes needed for common filters/lookups, including product brand/category/status and image ordering by product.
- Run Prisma generation after schema changes before typecheck/tests.

## Product Form Contract

- Product forms support:
  - `title`
  - `slug`
  - `description`
  - `status`
  - `categoryId`
  - `brandId`
  - `titleTh`
  - `titleEn`
  - `descriptionTh`
  - `descriptionEn`
- Product image management supports URL/metadata records only:
  - `url`
  - `altText`
  - `sortOrder`
  - `isPrimary`
  - `width`
  - `height`
- Variant forms support:
  - `sku`
  - `title`
  - `titleTh`
  - `titleEn`
  - `price`
  - `currency`
  - `weightGrams`
  - `lengthMm`
  - `widthMm`
  - `heightMm`
- Do not add binary image upload endpoints, presigned upload flows, S3/CDN orchestration, seller-created brand moderation, full admin brand CRUD UI, shipping rate calculation, or bulk actions in this milestone.
- Client validation should prevent obviously invalid submissions, but ownership, allowed state transitions, and trusted data rules remain backend responsibilities.
- Client validation must cover required product fields, required variant fields, and basic numeric constraints such as non-negative/positive price where applicable.
- Backend publish readiness validation must prevent `ACTIVE` products unless they have:
  - a category
  - at least one product image
  - at least one active variant with price greater than zero
- Draft products may be created or updated without category, images, brand, dimensions, or variants.
- Product and variant dialogs/drawers must detect unsaved edits and ask for confirmation before closing.
- Dirty-form protection is limited to closing product/variant dialogs or drawers; do not add browser-level navigation guards.

## Brand Contract

- Brands are global master data, not seller-owned records.
- Sellers may select an active brand or leave brand empty.
- Sellers must not create or modify brands from `/seller/products`.
- This milestone may add backend/admin API and seed/sample brand data.
- This milestone must not add full admin brand CRUD UI unless separately approved.

## Image Contract

- Product image management stores public image URLs and metadata only.
- Image URL validation should reject empty values and clearly invalid URL/path values.
- If multiple images are present, at most one image should be primary.
- Image ordering must be deterministic by `sortOrder` then creation order or id.
- Product image mutations must preserve seller ownership checks through the parent product.
- Public product/listing responses may expose image metadata needed by buyer UI, but must not expose private storage details.

## UI Data Table Contract

- Add a reusable default data table component under shared UI for TanStack Table + shadcn `<Table />` usage.
- The shared data table may provide common table mechanics such as:
  - sorting
  - filtering/search slot
  - pagination
  - column visibility where useful
  - row selection where enabled by callers
  - empty/loading state
- The shared data table must remain domain-agnostic and must not import seller/product business logic.
- `/seller/products` should define its own product/variant columns and row actions outside the shared table component.
- Do not refactor unrelated existing tables to the new data table in this milestone.
- The table container must remain usable on mobile and tablet through horizontal scrolling or equivalent responsive behavior without breaking the page layout.
- Table loading and empty states must be explicit and readable.

## Mutation UX Contract

- Successful create/edit/archive/delete actions must invalidate the relevant seller product TanStack Query data.
- Completed dialogs/drawers should close after successful mutation.
- Mutations should show clear success/error feedback through existing project UI patterns.
- Failed mutations must not silently clear user-entered form data.
- Product archive and variant delete actions must require explicit confirmation.
- Page-level product load failures must provide a retry action.

## Accessibility Contract

- Product and variant dialogs/drawers must have accessible labels and descriptions.
- Form controls must have labels or accessible names, and validation errors must be connected to the relevant field where practical.
- Icon-only buttons and row action triggers must include `aria-label` or `sr-only` text.
- Row actions must be keyboard reachable through standard shadcn/Radix interaction patterns.
- Empty, loading, and error states must be represented by visible text, not icons alone.

## Verification Contract

- Add focused component tests for the shared data table behavior needed by this milestone.
- Add focused component tests for `/seller/products` CRUD flows where practical.
- Add backend tests for schema-backed catalog behavior and publish readiness validation.
- Add tests or seed verification for brand list/admin API behavior where implemented.
- Include focused tests for production readiness behavior where practical:
  - dirty dialog close confirmation
  - page-level retry state
  - archive/delete confirmation
  - accessible action labels
- Run Prisma generation after schema changes.
- Run `bunx tsc --noEmit`.
