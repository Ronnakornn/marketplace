# Task 1: Discovery API Composition

## Goal

Provide bounded API responses for homepage, product listing/search, suggestions, and merchandising data using existing modules where possible.

## Affected Areas

- `server/modules/catalog/**`
- `server/modules/search/**`
- `server/modules/recommendation/**`
- `server/modules/promotion/**`
- `server/modules/admin/**` or marketing/banner module if existing
- `server/context/app-context.ts`
- `server/index.ts`
- backend tests

## Required Work

1. Add `GET /api/discovery/home`.
2. Compose homepage sections:
   - banners
   - categories
   - flash sale
   - recommended products
   - new arrivals
   - featured shops
   - recently viewed
   - promotions
3. Extend or confirm listing/search endpoints support:
   - keyword
   - category
   - brand
   - price range
   - rating
   - attributes/specs
   - in-stock
   - badges
   - sort
   - cursor/limit
4. Add or confirm `GET /api/search/suggestions`.
5. Keep product lists bounded and public-only.
6. Omit optional sections when data is unavailable instead of returning invalid placeholder data.

## Out of Scope

- New ranking engine.
- AI/semantic search.
- CMS/layout builder.

## Acceptance Criteria

- Homepage response can be rendered when any optional section is empty.
- Listing/search filters are validated and bounded.
- Public listing excludes inactive products and inactive shops.
- Suggestions are bounded by `limit`.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Focused tests:

- discovery home composition with missing optional data
- listing filters and sort
- public-only product filtering
- suggestions limit
