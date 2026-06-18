# Listing Filter Facets Contract

## Scope

Add first-pass metadata-driven filters for buyer listing/search.

## Required Facets

Responses that opt into listing metadata must expose:

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

Rules:

- Facet counts must be derived from backend-visible active products.
- Category and brand facets may be bounded to keep the response small.
- Price min/max must use trusted variant/product prices, not client-side product card prices after normalization.
- If facets cannot be calculated, the API may return empty arrays and `null` price bounds; frontend must degrade gracefully.

## Out of Scope

- Attribute/spec facets.
- Rating facets.
- Stock, shipping, and promotion facets.
- Personalized facet ranking.
