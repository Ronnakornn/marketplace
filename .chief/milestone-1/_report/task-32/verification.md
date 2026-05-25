# task-32 Verification

## Summary

Verified the seller product media and mobile UX increment locally for backend catalog/upload validation, frontend seller product behavior, shared data table behavior, stock invariants, and type safety.

## Commands

- `bun run db:generate` - passed; Prisma Client and prismabox regenerated with no tracked generated-file diff.
- `bunx vitest run server/modules/catalog/catalog.service.test.ts server/modules/upload/upload.service.test.ts server/modules/upload/upload.storage.test.ts app/features/seller/components/SellerProductPages.test.tsx app/features/seller/upload-helper.test.ts app/components/ui/data-table.test.tsx` - passed; 6 files, 66 tests.
- `bunx tsc --noEmit` - passed.
- `bunx vitest run app/features/seller/components/SellerManagePages.products.test.tsx` - not applicable in the current working tree; Vitest reported no matching test file at that path.

## Inspection Notes

- Product form stock fields keep `quantityReserved` and available stock read-only in `app/features/seller/components/SellerProductPages.tsx`.
- Variant stock submission excludes `quantityReserved`; the focused component test asserts the stock mutation payload does not include it.
- Client media limits are represented as 10 images, one `video/mp4` or `video/webm`, and 25MB max video size.
- Backend catalog/upload validation enforces the same product image count and product video type/size constraints.
- Upload failure and retry states are covered by the focused seller product page tests.
- Manual browser acceptance testing was not performed because task ownership is limited to local deterministic verification and small fallout fixes.
