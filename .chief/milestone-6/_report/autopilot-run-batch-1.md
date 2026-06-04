# Milestone 6 Autopilot Run Batch 1

## Scope Completed

- Discovery API composition for homepage sections, product listing/search filters, suggestions, and bounded merchandising data.
- Lightweight discovery tracking for product impressions/clicks, search/filter/category/banner/recommendation events, and recently viewed behavior.
- API-backed marketplace homepage sections for banners, categories, flash sale, recommendations, new arrivals, featured shops, recently viewed, and promotions.
- Search/category listing UX with URL-backed filters, mobile sheet, desktop sidebar, active chips, bounded requests, sort modes, and improved empty states.
- Product card merchandising with badges, favorite action, safe quick add, price ranges, rating/sold counts, shop/location, and tracking.
- Technical SEO baseline for product/category/search discovery pages with metadata, noindex/follow rules, Product/Breadcrumb JSON-LD, and sitemap-safe public entries.

## Commits

- `a937174` - `feat(milestone-6/task-1): add discovery home api`
- `aa2b82c` - `feat(milestone-6/task-2): add discovery tracking`
- `ad0ca510` - `feat(milestone-6/task-3): add discovery homepage UI`
- `6cd3c514` - `feat(milestone-6/task-4): upgrade discovery listing ux`
- task-5 SEO/report changes are committed in the final batch commit.

## Verification

Passed:

- `bunx tsc --noEmit --pretty false`
- `bunx vitest run app/lib/seo.test.ts`
- `bunx vitest run app/features/product/components/ProductBuyerStates.test.tsx`
- `bunx vitest run app/lib/seo.test.ts app/features/product/queries.test.ts app/features/product/components/ProductBuyerStates.test.tsx app/features/marketplace/components/MarketplaceHome.test.tsx`

Full suite:

- `bun run test` ran and passed 513 tests.
- Known/unrelated failures remain:
  - `server/modules/audit-log/audit-log.routes.test.ts`: admin route tests receive `403` instead of expected `200`.
  - `server/modules/fraud/fraud.routes.test.ts`: admin route tests receive `403` instead of expected `200`.
  - `app/features/seller/components/SellerProductPages.test.tsx`: three long seller variant/review tests timed out at the 5000ms test timeout.

## Browser Verification

Checked with the in-app Browser against `http://localhost:3000/th`:

- Homepage desktop: nonblank, product links present, no horizontal overflow.
- Homepage mobile: nonblank, product links present, no horizontal overflow.
- Search desktop: nonblank, filters visible, no horizontal overflow.
- Search mobile: nonblank, no horizontal overflow after adding `min-w-0` to listing grid/results.
- Category desktop: nonblank, product cards present, no horizontal overflow.
- Product detail mobile opened from a real product card: nonblank, images and CTAs present, no horizontal overflow.

Environment note:

- Local Redis is not running, so backend dev logs show `ECONNREFUSED 6379`; page/API checks still loaded through fallback behavior.

## Decisions

- Kept discovery tracking lightweight and reused existing log models instead of introducing an analytics platform.
- Kept search/filter pages `noindex/follow` where query-heavy/filter-heavy combinations are present.
- Omitted Product JSON-LD offers when no backed variant price exists instead of emitting a `0.00` offer.
- Preserved bounded discovery/listing requests; no UI requests unbounded product lists.
