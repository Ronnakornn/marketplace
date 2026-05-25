# Product UI Data Fetching Goal

## Objective

Standardize product data fetching across all UI surfaces that read product data, while preserving audience-specific access rules for public buyers, sellers, admins, and affiliate workflows.

## Scope

- Cover product read flows across UI surfaces:
  - public/buyer marketplace home, search, categories, deals, shop product listings, product detail, wishlist, and followed-shop product snippets
  - seller product management, inventory/product context, and product mutation refresh behavior
  - admin product/catalog management lists and detail reads
  - affiliate product target lookup where it reads product records
- Introduce shared product query hooks or query helpers organized by audience, such as public, seller, and admin.
- Move public/buyer product, category, product detail, and product discovery/search fetching toward Eden Treaty inferred types.
- Include catalog list/detail/category/shop-products and search products in the public product discovery query layer.
- Remove production-path demo/fallback product feeds from buyer product UI and replace them with real loading, error, and empty states.
- Standardize TanStack Query keys, pagination inputs, locale inputs, filters, sort, stale behavior, and retry/refetch paths for product reads.
- Standardize product-related query invalidation after seller/admin product, variant, image, and inventory mutations.

## Success Criteria

- Product UI reads use audience-specific query helpers instead of one-off product fetch logic.
- Public/buyer product fetching no longer depends on manually duplicated product response interfaces when Eden Treaty can infer the API type.
- Search and catalog product discovery consumers share consistent query-key construction for locale, query text, category, filters, sort, cursor/page, and limit.
- Seller and admin product reads keep existing authorization boundaries and do not share private query data with public/buyer queries.
- Seller/admin product mutations refresh affected product queries through clear invalidation helpers instead of only broad cache invalidation where more precise invalidation is practical.
- Buyer-facing product pages show honest loading, error, and empty states when real API data is unavailable.
- Production UI does not show demo products as if they were real inventory.
- Existing product visibility and status rules remain intact:
  - public listings/details expose active public products only
  - seller product reads remain scoped to seller-owned active shops
  - admin product reads remain protected by admin access
- Product listing and search results remain paginated.

## Out of Scope

- Replacing catalog, search, seller, and admin backend modules with a single product module.
- Changing checkout, cart pricing, inventory reservation, payment, order, or fulfillment business rules.
- Adding new product CRUD capabilities beyond invalidation behavior needed after existing mutations.
- Introducing global client state for product data outside TanStack Query.
- Redesigning product cards, seller product tables, admin product tables, or buyer page layouts unless needed to remove demo fallback states.
- Adding binary image upload, brand CRUD, or shipping-rate behavior.

## Verification Goal

- Add focused tests for product query-key helpers and audience separation where practical.
- Add focused UI/component tests for buyer product loading, error, and empty states after removing demo product fallback behavior.
- Add focused tests for seller/admin product mutation invalidation behavior where practical.
- Preserve or update existing catalog/search service tests when backend route typing or response contracts change.
- Run `bunx tsc --noEmit`.
- Run focused product UI tests and any affected catalog/search/seller/admin tests.
