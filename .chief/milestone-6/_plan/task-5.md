# Task 5: Technical SEO Baseline and Milestone Verification

## Goal

Add baseline metadata, structured data, sitemap behavior, and final verification for product discovery pages.

## Affected Areas

- product detail route metadata
- category route metadata
- search/listing route metadata
- sitemap route or generation logic
- `app/features/product/**`
- tests

## Required Work

1. Product detail metadata:
   - title
   - description/meta description
   - canonical URL
   - Open Graph primary image
2. Category page metadata:
   - title
   - description/meta description when available
   - canonical URL
3. Search/filter metadata:
   - noindex/follow for query-heavy or filter-heavy pages where appropriate
4. JSON-LD:
   - `Product` where required data exists
   - `BreadcrumbList` on product/category pages
5. Sitemap:
   - active products
   - active categories
   - exclude non-public products and inactive categories
6. Run milestone automated tests and Browser/Playwright screenshots.

## Out of Scope

- Full programmatic SEO.
- Content hub.
- Advanced GEO optimization.

## Acceptance Criteria

- Metadata renders without crashing when optional data is missing.
- JSON-LD does not emit invalid unsupported claims.
- Sitemap excludes draft, pending-review, rejected, suspended, archived, and inactive products.
- Browser screenshots verify homepage/search/category/product-card surfaces.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- homepage desktop and mobile
- search desktop and mobile
- category listing desktop
- product card grid mobile
