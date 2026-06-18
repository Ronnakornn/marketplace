# Goal: SKU Option Matrix

## Outcome

Products support structured SKU option matrices for common marketplace variants such as color and size.

## Scope

- Add product option and option value models.
- Link product variants to selected option values.
- Keep `ProductVariant` as the source for SKU, price, currency, dimensions, status, and inventory relation.
- Prevent duplicate SKU combinations within a product.

## Success Criteria

- Sellers can define options and values before or while creating variants.
- Variant responses include option values for seller/admin and public catalog use.
- Validation rejects duplicate option combinations and invalid option references.
- Existing plain variants remain migratable into the new structure.
