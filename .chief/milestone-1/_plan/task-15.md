# task-15: Extend catalog API and services for brand selection, product images, dimensions, and publish readiness

## Goal

Expose the new catalog fields through backend APIs and enforce publish readiness rules without weakening seller ownership boundaries.

## Scope

- Update catalog repository/service types for:
  - `brandId`
  - product images
  - variant dimensions/weight
- Include brand and images in product list/detail responses where needed by seller and buyer UI.
- Add seller-safe product image mutations if needed:
  - create image metadata
  - update image metadata
  - delete image metadata
  - set/maintain one primary image
- Add brand list endpoint for seller product forms.
- Add admin/backend brand API or seed access needed for admin-managed brands, without building full admin UI.
- Extend product create/update validation to accept `categoryId` and `brandId`.
- Extend variant create/update validation to accept normalized dimensions/weight fields.
- Enforce publish readiness when product status is `ACTIVE`:
  - category must be present
  - at least one product image must exist
  - at least one active variant with price greater than zero must exist
- Preserve draft flexibility: draft products can be saved without category, images, brand, dimensions, or variants.
- Preserve all seller ownership checks through active shop/product ownership.
- Keep TypeBox/Prismabox validation patterns.

## Out of Scope

- Do not add binary upload endpoints or signed upload flows.
- Do not add seller brand creation/moderation.
- Do not add full admin brand CRUD UI.
- Do not add shipping price calculation.

## Verification

- Add backend tests for publish readiness validation.
- Add backend tests for product image ownership and primary image behavior where implemented.
- Add backend tests for brand list/admin API behavior where implemented.
- Run relevant catalog tests.
- Run `bunx tsc --noEmit`.
