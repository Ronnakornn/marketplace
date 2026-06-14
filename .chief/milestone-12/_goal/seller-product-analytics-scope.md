# Seller Product Analytics Scope

## Goal

Give sellers a dedicated product analytics workspace that helps them understand product performance and decide what to improve.

## In Scope

- Seller-only product analytics as the first release.
- A new seller page for product analytics, expected at `/seller/analytics/products`.
- Navigation entry from the seller area and a contextual link from product management when appropriate.
- Product-level and variant/SKU-level performance summaries.
- Date range controls for 7 days, 30 days, 90 days, and custom date range.
- Daily aggregation for charts and tables.

## Out of Scope

- Admin analytics beyond any future read-only extension.
- Real-time minute-level analytics.
- Complex attribution, campaign attribution, or marketing source attribution.
- Bulk product operations, import/export, and catalog filter/facet improvements.

## Constraints

- Seller access must be isolated to products owned by the seller's shop.
- Analytics must not trust client-provided pricing or seller-provided revenue values.
- Keep domain logic in backend services and database access in repositories.
