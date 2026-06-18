# Product Detail Public API Alignment Contract

## Contract

The public product API and the buyer product detail route must agree on whether a product is publicly available.

## Requirements

- If the public API returns an active product as public, the product detail route must be able to resolve the same product.
- Visibility checks should be shared or kept structurally aligned to avoid future drift.
- The fix must preserve active product and active shop requirements.
- The implementation must avoid fake data, client-side fallbacks, or weakening server-side route guards.
- Data access should follow existing Prisma and repository patterns where available.

## Non-Goals

- Do not add new product API response fields unless required by the route fix.
- Do not change public listing/search ranking.
- Do not add database schema or seed changes unless the mismatch is proven to be data related.

## Acceptance

- The route/API mismatch is diagnosed and documented in the milestone report.
- Regression coverage proves API-visible active products are route-visible.
- Regression coverage proves unavailable products remain blocked.
