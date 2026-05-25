# task-10: Extend seller product hooks for complete product and variant mutations

## Goal

Make seller product frontend hooks cover all product and variant mutations needed by the `/seller/products` CRUD UI.

## Scope

- Update `app/features/seller/hooks/useSellerManage.ts`.
- Preserve existing `useSellerProducts`, `useCreateSellerProduct`, `useUpdateSellerProduct`, and `useCreateSellerVariant` behavior.
- Add or complete hooks for:
  - archive product via `DELETE /api/seller/products/:productId`
  - update variant via `PATCH /api/seller/products/:productId/variants/:variantId`
  - delete variant via `DELETE /api/seller/products/:productId/variants/:variantId`
- Include localized product fields in product input types:
  - `titleTh`
  - `titleEn`
  - `descriptionTh`
  - `descriptionEn`
- Include localized variant fields in variant input types:
  - `titleTh`
  - `titleEn`
- Invalidate seller product queries after successful mutations.

## Out of Scope

- Do not change backend endpoints unless the existing frontend API client cannot call them correctly.
- Do not add image/category/inventory mutations to the seller product CRUD hooks.

## Verification

- Add or update hook-adjacent component tests if hooks are exercised through `SellerProductsPage`.
- Run `bunx tsc --noEmit`.
