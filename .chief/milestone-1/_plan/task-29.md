# task-29: Extend seller hooks and upload helpers

## Goal

Add frontend data and mutation helpers needed for seller product create/edit pages to upload media through the local/module upload flow, attach media to products, and update simple variant stock.

## Scope

- Extend seller product hooks/types from Eden-inferred API responses.
- Add upload helper flow:
  - request presigned/local upload URL
  - PUT file to local upload URL
  - complete upload
  - return completed upload metadata for product media attachment
- Support image upload usage and product video upload usage.
- Add or extend hooks for:
  - image attachment/update/delete
  - video attachment/update/delete
  - variant create/update/delete
  - variant stock update through existing inventory mutation path or equivalent service endpoint
- Keep query invalidation aligned with shared product query helpers.

## Affected Areas

- `app/features/seller/hooks/useSellerManage.ts`
- `app/features/product/queries.ts`
- `app/lib/eden.ts` consumers
- Seller product tests where hook behavior is mocked

## Implementation Notes

- Do not manually duplicate backend DTOs. Continue deriving frontend response types from Eden where possible.
- Keep upload helper independent enough to be reused by seller onboarding or future media UI if practical, but avoid broad refactors.
- Failed uploads must surface an error and must not clear existing form state.
- Invalidation should refresh seller product list/detail and public product data when an active product/media mutation may affect buyer UI.
- Keep stock mutation limited to `quantityOnHand` and `reorderLevel`; never send `quantityReserved`.

## Verification

- Add focused tests for upload helper behavior where practical, or component tests covering the helper through UI.
- Verify mocked hook contracts used by seller product component tests are updated.
- Run:
  - `bunx tsc --noEmit`
  - focused frontend tests for seller product hooks/components
