# Contract: Discovery API

## Homepage Composition

Required endpoint:

- `GET /api/discovery/home`

Response sections:

- banners
- categories
- flashSale
- recommendedProducts
- newArrivals
- featuredShops
- recentlyViewed
- promotions

Rules:

- Sections may be empty or omitted when data is unavailable.
- Product lists must be paginated or bounded.
- Homepage composition should reuse catalog, recommendation, promotion, shop, and marketing data.
- Do not create a CMS or ranking engine in this milestone.

## Listing and Search

Required endpoints or existing endpoint extensions:

- `GET /api/products`
- `GET /api/catalog/products`
- `GET /api/search/products`
- `GET /api/categories/:categoryId/products`

Supported query fields:

- `q`
- `categoryId`
- `brandId`
- `minPrice`
- `maxPrice`
- `rating`
- `attributeFilters`
- `inStock`
- `badges`
- `sort`
- `cursor`
- `limit`

Supported sort values:

- `relevance`
- `newest`
- `price_asc`
- `price_desc`
- `top_sales`
- `rating`

Rules:

- Public product listing returns active products from active shops only.
- Large result sets must use pagination or cursor loading.
- Missing optional merchandising fields must not break response normalization.

## Suggestions

Required endpoint:

- `GET /api/search/suggestions`

Rules:

- Suggestions may come from recent searches, popular searches, categories, brands, or product titles.
- Suggestions must be bounded by `limit`.
