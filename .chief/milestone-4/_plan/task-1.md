# Task 1: Prisma Schema for Product, SKU, Category, and Inventory Ledger

## Goal

Update the Prisma schema so product management can support moderated product lifecycle, structured SKU options, category trees/spec definitions, and auditable inventory movements.

## Affected Areas

- `prisma/schema.prisma`
- generated Prisma client and prismabox output
- schema docs if architecture-visible changes need documentation

## Required Work

1. Extend `ProductStatus` with `PENDING_REVIEW`, `REJECTED`, and `SUSPENDED`.
2. Add SKU option models:
   - `ProductOption`
   - `ProductOptionValue`
   - `ProductVariantOptionValue`
3. Add uniqueness and indexes needed to prevent duplicate option combinations per product.
4. Add `InventoryMovement` and movement type enum.
5. Extend `Category` with `parentId` and parent/children relations.
6. Add `CategoryAttributeDefinition` and value type enum.
7. Preserve `Product.categoryId` as the single primary category.
8. Run Prisma format, validation, and generation.

## Acceptance Criteria

- Prisma schema validates.
- Generated client and prismabox schemas regenerate successfully.
- Existing product, variant, inventory, checkout, payment, and order relations remain intact.
- New models have indexes for product/category/inventory lookup paths used by later tasks.
- No generated files are manually edited.

## Verification

```bash
bunx prisma format
bunx prisma validate
bun run db:generate
```
