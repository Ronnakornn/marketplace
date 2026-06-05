# Contract: Product Spec Validation API

## Applies To

Seller product mutation flows:

- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`
- `POST /api/seller/products/:productId/submit-review`

## Validation Source

- Use the product category's active category spec definitions.
- Only specs with `isActive=true` participate in validation.
- Historical attributes from inactive specs may remain on existing products, but sellers cannot newly submit inactive spec keys as category-defined attributes.

## Attribute Rules

Product attributes submitted through `attributes[]` must obey:

- `attributeKey` is normalized with the existing catalog attribute-key normalizer.
- If `attributeKey` matches an active category spec, `displayName` and `isFilterable` are derived from the spec.
- Attributes that target inactive specs or specs from another category are rejected.
- Free-form additional specs remain allowed when they do not collide with category spec keys.
- Duplicate attribute keys are rejected.

## Type Rules

- `TEXT`: required values must be non-empty after trim.
- `NUMBER`: values must parse as finite numbers. Persist the normalized string form.
- `BOOLEAN`: accepted values include `true`, `false`, `yes`, `no`, `1`, and `0`; persist `true` or `false`.
- `SELECT`: values must be non-empty after trim. Option-list validation is out of scope.
- `MULTI_SELECT`: values may be comma-separated text; after splitting/trimming at least one item must remain. Persist normalized comma-separated text.

## Error Contract

Validation failures return `400` with stable catalog service error codes.

Required codes:

- `PRODUCT_SPEC_REQUIRED_MISSING`
- `PRODUCT_SPEC_TYPE_INVALID`
- `PRODUCT_SPEC_ATTRIBUTE_INVALID`
- `PRODUCT_SPEC_ATTRIBUTE_DUPLICATE`

## Out of Scope

- Schema changes for enum/range/regex rules.
- Option-list validation.
- Unit conversion.
- Automatic product attribute migration.
