# Goal: Technical SEO Baseline

## Outcome

Product and category discovery pages expose baseline metadata and crawl behavior suitable for marketplace launch.

## Scope

- Category page metadata, title, description, and canonical URL.
- Query-heavy search/filter pages use appropriate noindex/follow behavior.
- Product detail metadata comes from product data.
- Basic `Product` and `BreadcrumbList` JSON-LD when data is available.
- Sitemap entries for active products and active categories.
- Open Graph image uses product primary image or relevant banner when available.
- Do not implement full programmatic SEO, content hub, or advanced GEO optimization.

## Success Criteria

- Active products and categories are discoverable through sitemap output.
- Filter/search pages avoid creating uncontrolled index bloat.
- Metadata degrades safely when optional product/category data is missing.
- JSON-LD is valid for pages where required data exists.
