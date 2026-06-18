# Task 4: Seller Product and Inventory UI

## Goal

Build Seller Center screens for managing products, variants, media, inventory, and review submission.

## Affected Areas

- `app/seller/**`
- `app/features/catalog/**`
- `app/features/product/**`
- `app/features/seller/**`
- `app/features/inventory/**` if created
- frontend tests

## Required Work

1. Add or update `/seller/products` list with search, status filters, pagination, and empty/error states.
2. Add `/seller/products/new` draft creation flow.
3. Add `/seller/products/:productId` edit screen with sections:
   - content
   - category/specs
   - media
   - variant matrix
   - inventory
   - review submission
4. Add `/seller/inventory` with variant inventory table and low-stock filter.
5. Build variant matrix editor for structured options and option values.
6. Build inventory panel showing on-hand, reserved, available, and reorder level.
7. Build media controls for upload, attach, reorder, primary selection, alt text, and video.
8. Show moderation status and rejection reason.

## Acceptance Criteria

- Frontend data comes from Eden Treaty and React Query.
- UI handles loading, empty, error, forbidden, and pending mutation states.
- Product editor prevents submit-for-review when required sections are incomplete.
- Variant matrix editor surfaces duplicate combination errors.
- Inventory panel does not allow direct editing of reserved quantity.
- Shared UI components do not contain product business logic.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Use Browser/Playwright verification for main seller flows after implementation.
