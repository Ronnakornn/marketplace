# Related And Recently Viewed API Contract

## Scope

Provide lightweight product discovery data for buyer product detail without building a new recommendation engine.

## Related Products

Preferred endpoint:

```txt
GET /api/products/:productId/related
```

Query:

- `locale?`
- `limit?` default 8, max 12

Selection rules:

- Only active products from active shops.
- Exclude the current product.
- Prefer same category.
- Then prefer same shop or shared brand where practical.
- Use deterministic ordering such as best available stock/sold count/newest fallback.

Response:

- Same card-ready product shape as public listing/search where practical.

## Recently Viewed

Existing endpoint may be reused:

```txt
GET /api/discovery/recently-viewed
```

Required behavior:

- It must be safe for authenticated and anonymous/session-based buyers.
- It must not expose another user's browsing data.
- Product cards should use the same normalized buyer product/card shape where practical.

## Constraints

- No new recommendation engine.
- No campaign attribution.
- Related/recently viewed sections must not block primary product detail rendering.
- Large lists are not required; keep limits small.

## Tests

Required tests:

- Related products exclude the current product.
- Related products only return active products from active shops.
- Recently viewed respects user/session isolation.
- Empty related/recently viewed responses are valid.
