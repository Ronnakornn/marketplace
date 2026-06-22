# Task 02: Align Product Detail Route SEO Lookup

## Objective

Fix the smallest server-side route/SEO lookup surface so buyer product detail routes render for active public products that the public API can return.

## Scope

- Update product detail SEO lookup or page guard query to align with public product visibility.
- Preserve supported product id and slug lookup behavior.
- Preserve not-found behavior for unavailable products.
- Keep canonical metadata as `/products/<product.id>` unless the diagnosis proves a narrow route fix requires otherwise.

## Likely Files

- `app/lib/seo.ts`
- `app/[locale]/(public)/products/[productId]/page.tsx`
- Shared catalog/public product visibility helper if one already exists.

## Constraints

- Do not weaken active product and active shop requirements.
- Do not expose inactive, deleted, suspended, or private products.
- Do not change checkout, payment, order, cart, inventory, or fulfillment behavior.
- Avoid broad refactors and avoid new abstractions unless they prevent duplicated visibility logic.

## Verification

- Known active seeded product resolves through the route guard and metadata path.
- Unavailable product still resolves to not-found behavior.
