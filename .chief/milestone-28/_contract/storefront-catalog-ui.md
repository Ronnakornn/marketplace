# Contract: Storefront Catalog Browse UI

## Existing API Reuse

Use the existing endpoint:

```text
GET /api/shops/:shopId/products
```

with `locale`, `q`, `categoryId`, `sort`, `page`, and `limit` query parameters.
The storefront page size is 12.

## Sort Semantics

Supported storefront sort values are:

- `newest`: product creation descending, then product ID descending.
- `price_asc`: minimum price among active variants ascending, then product ID.
- `price_desc`: minimum price among active variants descending, then product ID.

The repository must honor these values at the data source. Storefront price
sorting uses page-based pagination until a stable composite cursor exists;
product-ID-only cursors must not be used for price ordering.

## URL State

- URL query state is the source of truth for `q`, `category`, and `sort`.
- Text search is debounced and writes with `router.replace`, not one history
  entry per keystroke.
- Changing search, category, or sort resets accumulated products to page 1.
- Load more increments the page and appends results without modifying the base
  filter URL semantics.

## Facets and Results

- Category options come from the existing shop-scoped response facets.
- Facet counts include only active public products in the selected shop.
- The result summary distinguishes total matching products from products
  currently rendered.
- Additional pages append by product ID and must not render duplicates.
- A next-page failure preserves existing products and exposes retry.

## Product Card

- Reuse `ProductCard` with an additive `showShopIdentity?: boolean` prop whose
  default preserves current behavior.
- The storefront passes `showShopIdentity={false}` because shop identity is
  already established by the page.
- Real primary product images, localized product fields, price/range, rating,
  sold count, stock, wishlist, detail fallback, and safe quick-add behavior
  remain owned by the shared card.
- Out-of-stock products remain visible and clearly unavailable.

## Responsive Controls

- Desktop may place search, category, and sort in one toolbar.
- Mobile uses a full-width search field and compact Select controls below it.
- Controls, loading, empty, end-of-results, and retry states have Thai and
  English labels and accessible names.
