# Brand and Product Enrichment Contract

## Schema Contract

- Extend `Brand` rather than replacing it.
- Brand must remain global master data, not seller-owned.
- Brand should support:
  - `name`
  - `nameTh`
  - `nameEn`
  - `slug`
  - `code`
  - `description`
  - `descriptionTh`
  - `descriptionEn`
  - `logoUrl`
  - `websiteUrl`
  - `countryCode` or equivalent origin field
  - `sortOrder`
  - `isFeatured`
  - `isActive`
  - timestamps
- Brand slug and code uniqueness must be preserved.
- Extend `Product` with buyer-facing facts:
  - `metaTitle`
  - `metaDescription`
  - `warrantyInfo`
  - `condition`
  - `countryOfOrigin`
- Product highlights should support ordered bullet text. Use either a dedicated model or a structured field only if it remains queryable and maintainable.
- Add product attributes/specifications as a dedicated model unless a stronger reason emerges during implementation.
- Product attributes must support:
  - `productId`
  - normalized `attributeKey`
  - display name
  - value
  - localized display/value fields where practical
  - `sortOrder`
  - `isFilterable`
  - timestamps
- Product attribute uniqueness should prevent duplicate normalized keys per product where practical.
- Add indexes for common lookup/filter paths:
  - brand active/sort/search
  - product brand/category/status/deletedAt
  - filterable product attributes by key/value
- After schema changes, run Prisma format/validate/generate before typecheck/tests.

## Brand Admin Contract

- Admin brand management must be protected with existing admin authorization patterns.
- Admin brand APIs should support:
  - list/search brands with pagination
  - create brand
  - update brand
  - deactivate/archive brand
  - reactivate brand
- Brand deactivate/archive must not remove existing product references.
- Products linked to inactive brands may keep the historical brand relation, but sellers should not select inactive brands for new changes.
- Brand mutation validation must normalize slugs and reject duplicate slug/code conflicts.
- Use `appContext.logger`; do not use `console.log`.

## Seller Product Contract

- Seller product forms may select active brands or no brand.
- Sellers must not create, edit, deactivate, or reactivate brands.
- Seller product create/update may include product enrichment fields:
  - meta title/description
  - highlights
  - warranty info
  - condition
  - country of origin
  - product attributes/specifications
- Seller ownership validation must remain enforced for all product enrichment mutations.
- Draft products may omit enrichment fields.
- Publishing rules from the seller product CRUD contract remain in force.
- Product enrichment must not turn `/seller/products` into inventory, shipping-rate, or policy management.

## Public Buyer Contract

- Public product list/search/category APIs may accept:
  - `brandId`
  - exact-match filterable attribute filters
- Public product reads must continue to expose only public active products and active public shop context.
- Public product detail responses should include buyer-facing brand profile data, highlights, facts, and ordered specifications.
- Buyer UI should show brand/spec/highlight information where useful without redesigning the entire buyer experience.
- Buyer filtering should be simple exact-match filtering for this increment.
- Advanced facet counts, range filters, brand landing pages, and analytics-powered recommendations are out of scope.

## Search and Query Contract

- Existing product query layer should include brand and attribute filter inputs where public product discovery uses them.
- Cache/query keys must include `brandId` and attribute filters when they affect results.
- Search module ownership may remain separate from catalog module ownership.
- Search/listing result compatibility should be preserved for existing consumers.
- Backend changes should preserve pagination and avoid N+1 relation loading.

## Seed Contract

- Provide separate seed paths for:
  - bootstrap master data
  - local/dev demo catalog data
- Bootstrap master seed may create or upsert categories and brands.
- Demo catalog seed may create/upsert demo shops/products/variants/inventory/images/highlights/facts/attributes and assign brands.
- Seed scripts must be non-destructive by default.
- Seed scripts must not randomly overwrite real data.
- Seed scripts should be idempotent enough for repeated local runs.
- Demo seed behavior must be clearly named so it is not confused with production bootstrap.

## UI Contract

- Admin brand UI should use existing admin UI patterns and protected admin routes.
- Seller product UI should extend the existing product dialog/workspace rather than replacing the seller products page.
- Buyer product cards/details/listing/search/category pages should show brand/spec data only where it improves browsing and does not create layout clutter.
- UI controls for brand/attribute filters must have accessible labels and usable empty/loading/error states.
- Do not add a brand landing page in this increment.

## Verification Contract

- Backend tests must cover:
  - admin brand create/update/deactivate/reactivate/list/search
  - duplicate brand slug/code handling
  - active-only seller brand selection
  - product enrichment create/update ownership checks
  - public product filtering by brand and filterable attributes
- Frontend tests should cover:
  - admin brand management flows where practical
  - seller product form brand/enrichment fields where practical
  - buyer display/filter behavior where practical
- Seed verification should cover:
  - bootstrap master seed creates/upserts brands/categories safely
  - demo catalog seed includes brands, products, variants, inventory, images, highlights/facts, and attributes
- Required commands after schema changes:
  - `bunx prisma format`
  - `bunx prisma validate`
  - `bun run db:generate`
  - `bunx tsc --noEmit`
- Run focused affected test suites for catalog, admin, seller, buyer product UI, and seed logic.
