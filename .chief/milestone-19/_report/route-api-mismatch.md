# Route/API Mismatch Diagnosis

## Product Detail Route

- Route: `app/[locale]/(public)/products/[productId]/page.tsx`
- Guard: `requirePublicProductSeo(productId)`
- Lookup: `getPublicProductSeo(productId)` in `app/lib/seo.ts`

## Public Product API

- Public list: `CatalogService.listPublicProducts`
- Public detail: `CatalogService.getPublicProductDetail`
- Repository source: `PrismaCatalogRepository.findProducts` and `findProductById`

## Mismatch Found

The public product API treats deleted products as unavailable:

- Public listing filters include `deletedAt: null`.
- Public detail rejects a product when `product.deletedAt` is present.

The product detail SEO/page guard lookup required `status: "ACTIVE"` and `shop.status: "ACTIVE"`, but did not require `deletedAt: null`.

## Fix

`getPublicProductSeo` now includes `deletedAt: null`, aligning the route guard with public product API visibility for active, non-deleted products from active shops.

## Regression Coverage

`app/lib/seo.test.ts` now covers:

- Active product with active shop resolves by id.
- Supported slug lookup resolves while canonical URL remains `/products/<product.id>`.
- Missing or unavailable lookup returns `null`.
