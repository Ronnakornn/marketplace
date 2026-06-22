# Contract: Database Schema

## Product Status

Extend `ProductStatus`:

- `DRAFT`
- `PENDING_REVIEW`
- `ACTIVE`
- `REJECTED`
- `SUSPENDED`
- `ARCHIVED`

Public catalog queries must return only `ACTIVE` products from `ACTIVE` shops.

## SKU Options

Add `ProductOption`:

- `id`
- `productId`
- `name`
- `nameTh`
- `nameEn`
- `sortOrder`
- `createdAt`
- `updatedAt`

Add `ProductOptionValue`:

- `id`
- `optionId`
- `value`
- `valueTh`
- `valueEn`
- `displayType`
- `colorHex`
- `sortOrder`
- `createdAt`
- `updatedAt`

Add `ProductVariantOptionValue`:

- `id`
- `variantId`
- `optionValueId`
- `createdAt`

Rules:

- `ProductVariant` remains the source of SKU, price, currency, dimensions, status, and inventory relation.
- Variant option value combinations must be unique per product.
- A variant cannot reference option values from another product.

## Inventory Movement

Add `InventoryMovement`:

- `id`
- `inventoryId`
- `variantId`
- `type`
- `quantityDelta`
- `quantityOnHandBefore`
- `quantityOnHandAfter`
- `quantityReservedBefore`
- `quantityReservedAfter`
- `actorUserId`
- `reason`
- `referenceType`
- `referenceId`
- `metadata`
- `createdAt`

Movement types:

- `ADJUSTMENT`
- `RESERVATION_CREATED`
- `RESERVATION_RELEASED`
- `RESERVATION_COMMITTED`
- `SALE_COMMITTED`
- `RETURN_RESTOCK`

Rules:

- Every service-level inventory mutation must create a movement record in the same transaction.
- Quantity fields must never become negative.

## Category Tree and Specs

Extend `Category`:

- `parentId`
- relation to parent and children

Add `CategoryAttributeDefinition`:

- `id`
- `categoryId`
- `attributeKey`
- `displayName`
- `displayNameTh`
- `displayNameEn`
- `valueType`
- `isRequired`
- `isFilterable`
- `allowedValues`
- `sortOrder`
- `createdAt`
- `updatedAt`

Rules:

- `Product.categoryId` remains a single primary category.
- Category attributes define product spec requirements and filterable attributes.
