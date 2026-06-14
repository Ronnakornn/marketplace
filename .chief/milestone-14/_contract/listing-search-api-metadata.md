# Listing Search API Metadata Contract

## Affected Endpoints

- `GET /api/products`
- `GET /api/catalog/products`
- `GET /api/search/products`
- `GET /api/categories/:categoryId/products`

## Query Inputs

Supported public listing/search query inputs:

- `q` or `keyword`
- `categoryId`
- `brandId`
- `minPrice`
- `maxPrice`
- `sort`
- `page`
- `limit`
- `locale`

Rules:

- `page` is 1-based.
- `limit` must remain bounded by the existing public max limit.
- Existing `cursor` behavior may remain, but buyer listing UX for this milestone uses page-based load more unless an existing service already requires cursor.

## Response Shape

Public listing/search responses must include:

```ts
{
  items: ProductListItem[]
  meta: {
    totalCount: number
    page: number
    pageSize: number
    hasNextPage: boolean
    query: {
      q?: string
      categoryId?: string
      brandId?: string
      minPrice?: number
      maxPrice?: number
      sort?: string
    }
  }
}
```

Rules:

- `totalCount` must reflect the same trusted backend filters used to fetch `items`.
- `hasNextPage` must be derived from `totalCount`, `page`, and `pageSize`, or from an equivalent bounded over-fetch.
- Response must remain compatible with existing frontend normalizers during migration.
- Public results must include only active products from active shops.
