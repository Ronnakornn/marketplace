# Task 3: Homepage Merchandising UI

## Goal

Build a real-data marketplace homepage that presents merchandising sections without relying on mock-only blocks.

## Affected Areas

- `app/page.tsx`
- `app/features/marketplace/**`
- `app/features/product/**`
- `app/features/catalog/**`
- frontend tests

## Required Work

1. Fetch `GET /api/discovery/home` with Eden/React Query.
2. Render sections in stable order:
   - banner carousel
   - category grid/tree
   - flash sale rail
   - recommended products
   - new arrivals
   - featured shops
   - recently viewed
   - voucher/promotion strip
3. Use product card contract for product rails.
4. Add loading, empty, error, and partial data states per section.
5. Link sections to product, category, shop, promotion, or search destinations.
6. Emit banner/recommendation/product click events where applicable.

## Out of Scope

- Homepage CMS.
- Drag-and-drop layout editing.
- Major brand redesign.

## Acceptance Criteria

- Homepage renders from API data.
- Missing optional sections do not break the page.
- Product rails are bounded and responsive.
- Mobile and desktop layouts avoid text/control overlap.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- homepage desktop
- homepage mobile
- partial-data homepage state when practical
