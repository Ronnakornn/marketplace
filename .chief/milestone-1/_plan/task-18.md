# task-18: Add audience-specific product query keys, hooks, and invalidation helpers

## Goal

Create the shared frontend foundation for product data reads and product-related invalidation without changing UI behavior yet.

## Scope

- Add a product query layer under the existing frontend feature structure, preferably near `app/features/product/`.
- Define audience-specific query key helpers for:
  - public product discovery/detail/category/shop-products/search
  - seller product reads
  - admin product reads
  - affiliate product target lookup if present
- Add query hooks or query option helpers that use Eden Treaty where available.
- Add named invalidation helpers for product-related mutations.

## Implementation Notes

- Keep public, seller, admin, and affiliate query keys separated enough that private data cannot share public cache keys.
- Public query keys must include behavior-changing inputs: locale, query, category, shop, filters, sort, cursor/page, and limit.
- Prefer Eden-inferred response types. If an endpoint cannot be represented cleanly yet, create a small adapter typed from API-derived input where practical.
- Do not move backend modules or redesign response contracts unless Eden typing blocks the frontend foundation.
- Keep helpers small and explicit. Avoid broad global state outside TanStack Query.

## Verification

- Add focused tests for query-key construction.
- Include public vs seller/admin key separation tests where practical.
- Run the focused new tests.
- Run `bunx tsc --noEmit` before marking the task complete.
