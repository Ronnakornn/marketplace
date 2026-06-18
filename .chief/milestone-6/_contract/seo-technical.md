# Contract: Technical SEO

## Metadata

Required behavior:

- Product detail metadata uses product title, description/meta description, primary image, and canonical URL.
- Category pages use category name, description/meta description when available, and canonical URL.
- Search or filter-heavy pages use noindex/follow when query combinations should not be indexed.

## Structured Data

Add JSON-LD when data is available:

- `Product` on product detail pages.
- `BreadcrumbList` on product and category pages.

Rules:

- JSON-LD must omit fields when required source data is unavailable rather than emitting invalid data.
- Product structured data should not claim offers or ratings that are not backed by data.

## Sitemap

Sitemap includes:

- active products
- active categories

Rules:

- Exclude archived, suspended, rejected, draft, or pending-review products.
- Exclude inactive categories.
- Sitemap generation should remain bounded and safe for production.
