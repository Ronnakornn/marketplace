# task-2: Backend Listing Filter Facets

## Objective

Add first-pass backend-derived facets for category, brand, and price range to public listing/search responses.

## Scope

- Catalog/search service and repository paths used by public buyer listing/search endpoints.
- Response normalization needed to include `facets` next to `items` and `meta`.

## Required Behavior

Return facet metadata:

```ts
{
  facets: {
    categories: Array<{
      id: string
      slug: string
      name: string
      count: number
      active: boolean
    }>
    brands: Array<{
      id: string
      name: string
      slug?: string
      count: number
      active: boolean
    }>
    price: {
      min: number | null
      max: number | null
      currency: string
    }
  }
}
```

- Category and brand counts must come from backend-visible active products.
- Price range must use trusted product/variant prices.
- Facet lists must be bounded to avoid large responses.
- If a facet cannot be calculated, return empty arrays or `null` price bounds rather than failing the full listing.

## Constraints

- Do not add spec/attribute facets.
- Do not add rating/stock/shipping/promotion facets.
- Do not trust client-side filtering for counts.

## Verification

- Add/update backend tests for facet response shape and count filtering.
- Run:

```bash
bun run test server/modules/catalog server/modules/search
bunx tsc --noEmit
```
