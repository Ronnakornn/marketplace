# task-14: Extend catalog schema for product images, brands, and variant shipping dimensions

## Goal

Extend the catalog data model so products can carry production listing metadata: categories, admin-managed brands, product image metadata, and variant shipping dimensions.

## Scope

- Update `prisma/schema.prisma`.
- Add a global `Brand` model with fields suitable for admin-managed master data:
  - stable id
  - name
  - optional slug/code if useful for lookup
  - active/inactive state
  - timestamps
- Add nullable `brandId` relation on `Product`.
- Preserve existing nullable `categoryId` on `Product`.
- Add a `ProductImage` model with:
  - `productId`
  - `url`
  - `altText`
  - `sortOrder`
  - `isPrimary`
  - `width`
  - `height`
  - timestamps
- Add normalized integer fields to `ProductVariant`:
  - `weightGrams`
  - `lengthMm`
  - `widthMm`
  - `heightMm`
- Add indexes for common brand/category/status/product image lookups.
- Add or update seed/sample data for brands if the project seed structure has an appropriate place.
- Run Prisma generation after schema changes.

## Out of Scope

- Do not add binary upload storage, presigned URLs, or S3/CDN upload orchestration.
- Do not add seller-created brand moderation.
- Do not add shipping rate calculation.
- Do not hard-require dimensions at the database level.

## Verification

- Run `bun run db:generate`.
- Run schema/type checks required by the repo.
- Add/update schema-adjacent tests only where existing test patterns make it practical.
