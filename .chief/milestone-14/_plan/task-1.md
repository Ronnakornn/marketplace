# task-1: Backend Listing Result Metadata

## Objective

Extend public listing/search backend responses with result metadata so buyer UI can show exact result counts and load-more state from trusted backend data.

## Scope

- `GET /api/products`
- `GET /api/catalog/products`
- `GET /api/search/products`
- `GET /api/categories/:categoryId/products`
- Catalog/search service and repository paths needed to return metadata.

## Required Behavior

- Accept bounded `page` and `limit` inputs.
- Return:

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

- `totalCount` must reflect the same filters used for `items`.
- `hasNextPage` must be correct for the returned `page` and `pageSize`.
- Existing response consumers that normalize `{ items }`, `{ data }`, or arrays must continue to work where practical.

## Constraints

- Do not change Prisma schema unless strictly required.
- Keep public results restricted to active products from active shops.
- Do not implement facets in this task.
- Do not add semantic search or ranking changes.

## Verification

- Add/update backend tests for catalog and search metadata.
- Run:

```bash
bun run test server/modules/catalog server/modules/search
bunx tsc --noEmit
```
