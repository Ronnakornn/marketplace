# Task 01: Diagnose Product Detail Route/API Mismatch

## Objective

Find the exact cause of the mismatch where a seeded active product is returned by the public product API but the buyer product detail route renders public 404.

## Scope

- Compare public product API query behavior with product detail SEO/page guard lookup behavior.
- Inspect same-origin frontend API result and product detail route result for the same known product.
- Document the cause and evidence in `.chief/milestone-19/_report/route-api-mismatch.md`.

## Likely Files

- `app/[locale]/(public)/products/[productId]/page.tsx`
- `app/lib/seo.ts`
- `server/modules/catalog/**`
- Product API route/proxy files if needed.

## Constraints

- Do not change product behavior in this task unless the diagnosis requires a tiny instrumentation-free correction.
- Do not add console logging.
- Do not modify seed data unless the mismatch is proven to be seed-only.

## Verification

- Record the exact product id/slug used.
- Record `/api/products` result and product detail route result.
- Record the mismatching query or guard condition.
