# Product Detail Route Readiness

## Goal

Make buyer product detail routes render for active public products that the product API can return.

## In Scope

- Server-side product detail route guard and SEO lookup behavior.
- Alignment between public product API visibility and product detail page visibility.
- Product id and slug lookup behavior where supported by existing routing.
- Public 404 behavior for unavailable, inactive, or missing products.

## Out of Scope

- Checkout, payment, order, and fulfillment behavior.
- Product detail visual redesign beyond what is needed for route readiness.
- Product listing/search/home redesign.
- Database schema changes unless a verified inconsistency requires them.

## Constraints

- Keep canonical metadata path as `/products/<product.id>` unless a narrow fix requires otherwise.
- Do not weaken product/shop active-status visibility rules.
- Do not expose inactive, deleted, suspended, or private products.
