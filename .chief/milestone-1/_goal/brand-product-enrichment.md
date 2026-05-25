# Brand and Product Enrichment Goal

## Objective

Complete brand support as marketplace master data and enrich products with buyer-usable specifications, facts, and seed data so products can be browsed, filtered, and managed with production-ready catalog context.

## Scope

- Extend brand master data for buyer-ready usage:
  - logo URL
  - localized name and description
  - website URL
  - country or origin
  - sort order
  - featured flag
  - active/archive state
- Add admin-owned brand management:
  - list and search brands
  - create brand
  - edit brand profile fields
  - archive/deactivate and reactivate brands
- Preserve seller brand behavior:
  - sellers may select active brands for products
  - sellers may leave brand empty
  - sellers must not create or modify brands in this increment
- Add product enrichment fields:
  - SEO title and description
  - bullet highlights
  - warranty information
  - product condition
  - country of origin
- Add product attributes/specifications:
  - product-level key-value attributes
  - normalized `attributeKey`
  - localized display names/values where practical
  - sort order
  - `isFilterable` for basic buyer filtering
- Add buyer-facing usage:
  - display brand information on product cards/details/listing where useful
  - display product highlights, facts, and specifications on product detail
  - support product listing/search/category filtering by `brandId`
  - support basic exact-match filtering for filterable product attributes
- Add seed data coverage:
  - bootstrap master seed for brands and categories
  - local/dev demo catalog seed for products, variants, inventory, images, attributes/specs, highlights, facts, and brand assignments
  - seed scripts must be non-destructive and environment-safe

## Success Criteria

- Admin users can manage brand master records without exposing brand mutation routes publicly.
- Brand records contain enough profile data for buyer-facing UI and product filters.
- Seller product forms continue to select only active brands and cannot create brand records.
- Public product list/search/category APIs can filter by brand and basic filterable attributes while preserving active product visibility.
- Product detail responses include brand, highlights, product facts, and specifications needed by buyer UI.
- Product enrichment does not duplicate shop return/shipping policies or checkout/shipping domain rules.
- Product attributes are normalized enough to avoid obvious duplicate keys such as case-only variants.
- Demo catalog seed creates realistic product data across brands, categories, variants, inventory, images, attributes/specs, highlights, and facts.
- Bootstrap seed can be run safely for master data without destroying existing data.

## Out of Scope

- Seller-created brand request or approval workflow.
- Full category-defined attribute template management UI.
- Advanced faceted search counts, range filters, or analytics-backed recommendations.
- Brand landing pages such as `/brands/[slug]`.
- Product moderation workflow redesign.
- Binary product image upload, CDN orchestration, or presigned upload flows.
- Checkout, cart pricing, inventory reservation, payment, order, shipment, or return policy changes.

## Verification Goal

- Add backend tests for brand admin CRUD, access protection, validation, archive/reactivate behavior, and product brand validation.
- Add backend tests for product attribute/spec creation/update and public filtering by brand/attribute.
- Add seller UI tests for brand selection and product enrichment fields where practical.
- Add buyer UI tests for brand/spec/highlight display and brand/attribute filters where practical.
- Add seed verification for bootstrap master data and demo catalog data where practical.
- Run Prisma format/validate/generate after schema changes.
- Run `bunx tsc --noEmit`.
- Run focused catalog/admin/seller/buyer tests affected by this extension.
