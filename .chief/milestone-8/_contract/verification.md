# Contract: Verification

## Required Commands

Run after implementation:

```bash
bun run db:generate
bunx tsc --noEmit --pretty false
bunx vitest run server/modules/catalog/catalog.service.test.ts server/modules/catalog/catalog.routes.test.ts app/features/seller/components/SellerProductPages.test.tsx app/features/product/components/ProductBuyerStates.test.tsx
bun run test
```

## Required Coverage

- Catalog service rejects invalid spec values and missing required specs.
- Catalog service allows valid normalized number, boolean, select, and multi-select values.
- Public listing/search routes reject invalid attribute filter keys with `400`.
- Existing valid attribute filters continue to work.
- Seller product UI renders type-aware category spec controls.
- Additional free-form attributes remain supported.

## Browser Verification

After deterministic tests pass:

- Open seller product studio for a seeded/demo product.
- Confirm number and boolean category specs render type-aware controls.
- Confirm required spec hints are visible.
- Confirm additional specs area remains available.

## Documentation

Write final verification notes under:

```txt
.chief/milestone-8/_report/
```
