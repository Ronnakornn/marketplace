# Product Detail Route SEO Contract

## Contract

Buyer product detail routes must render for active public products that the public product API can return.

## Requirements

- Product detail page guard and metadata lookup must use product visibility rules that agree with the public product API.
- Active product with active shop must resolve by product id.
- Existing supported slug lookup behavior must continue to resolve where applicable.
- Missing, inactive, suspended, deleted, or private products must still return not-found behavior.
- Canonical metadata must remain `/products/<product.id>` unless a narrow verified route fix requires otherwise.

## Non-Goals

- Do not redesign product detail UX in this milestone.
- Do not change checkout, payment, order, fulfillment, inventory, cart, or review behavior.
- Do not expose unavailable products to public routes.

## Acceptance

- A known seeded active product that appears in `/api/products` can render through the Next.js product detail route.
- Not-found behavior remains covered for unavailable products.
- Metadata generation does not create a route mismatch with the product page guard.
