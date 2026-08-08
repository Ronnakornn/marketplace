# Task 3: Shop Catalog and Shared Marketplace Chrome

## Objective

Make the storefront catalog fully shop-scoped, URL-driven, sortable, and
consistent with the homepage marketplace navigation and product cards.

## Dependencies

- Task 2 must be complete.

## Inputs

- Goal: `../_goal/storefront-catalog-and-actions.md`
- Contracts: `../_contract/storefront-catalog-ui.md`,
  `../_contract/storefront-navigation-tracking-verification.md`

## Ownership

- Shop product listing repository/service/routes and tests under
  `server/modules/catalog/**`
- Storefront catalog UI, state, queries, and tests under
  `app/features/storefront/**`
- `app/features/product/components/ProductCard.tsx`
- Shared buyer navigation in `app/components/BuyerShell.tsx` or one adjacent
  shared component extracted from it
- Homepage navigation call site in
  `app/features/marketplace/components/MarketplaceHome.tsx`
- `app/components/AppChrome.tsx` and the public shop page integration

## Implementation Order

1. Extend the existing `GET /api/shops/:shopId/products` contract with
   `newest`, `price_asc`, and `price_desc` sorting and 12 products per page.
2. Implement sorting in the catalog repository. Price means the minimum price
   of an active sellable variant. Use stable page-based pagination for price
   sorting and add deterministic tie breakers.
3. Add repository/service/route tests for shop isolation, category filtering,
   search, active variants, ties, out-of-stock visibility, and all sort modes.
4. Build the storefront catalog using inferred API types and TanStack Query.
   Treat `q`, `category`, and `sort` URL parameters as the source of truth.
   Debounce search updates, use `router.replace`, and reset pagination whenever
   a filter changes.
5. Add category facets, sort control, 12-item initial result, explicit load
   more, ID deduplication, loading, empty, retryable next-page failure, and
   terminal states. Keep out-of-stock products visible with a localized badge.
6. Add `showShopIdentity?: boolean` to the shared `ProductCard`, defaulting to
   current behavior. Set it to false only on a shop storefront.
7. Reuse `BuyerTopBar`. Extract the homepage mobile bottom navigation into one
   shared buyer component and render it on both home and storefront without a
   false active state on shop routes.
8. Preserve the `AppChrome` public-shop bypass so no legacy header, footer, or
   nested main wrapper reappears.

## Constraints

- The repository performs sorting/filtering; do not sort a fetched page in the
  browser.
- Product data must remain limited to the resolved shop.
- Do not duplicate buyer header, mobile navigation, or product-card markup.
- Loading another page must not erase already rendered products.
- Invalid URL values fall back to documented defaults without crashing.

## Acceptance Criteria

- Search, category, and sort state survives refresh and browser navigation.
- Newest and both price sorts are correct across pages and variant prices.
- Load more appends unique products and supports retry after a page failure.
- Storefront cards omit redundant shop identity while other card usages do not
  change.
- Desktop and mobile marketplace chrome matches the homepage shared components.

## Verification

- `bun run test -- server/modules/catalog`
- Run focused storefront catalog, ProductCard, and navigation tests.
- `bunx tsc --noEmit`
- `bun run audit:i18n`

