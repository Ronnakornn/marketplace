# Task 2: Enforce Seller Product Spec Validation

## Goal

Apply the spec validation helpers to seller product create, update, and submit-for-review flows.

## Affected Areas

- `server/modules/catalog/catalog.service.ts`
- `server/modules/catalog/catalog.routes.ts` if response/error contract adjustments are needed
- `server/modules/catalog/catalog.service.test.ts`
- `server/modules/catalog/catalog.routes.test.ts`

## Required Work

1. Enforce validation during `createSellerProduct`.
2. Enforce validation during `updateSellerProduct`.
3. Enforce validation during submit-for-review/readiness checks.
4. Preserve existing behavior for free-form attributes that do not match category spec keys.
5. Preserve existing historical inactive attributes when a product is updated without replacing attributes.
6. Ensure `displayName` and `isFilterable` for category-defined attributes are derived from active spec definitions.
7. Use stable error codes from the contract:
   - `PRODUCT_SPEC_REQUIRED_MISSING`
   - `PRODUCT_SPEC_TYPE_INVALID`
   - `PRODUCT_SPEC_ATTRIBUTE_INVALID`
   - `PRODUCT_SPEC_ATTRIBUTE_DUPLICATE`

## Out of Scope

- Changing product attribute database schema.
- Migrating existing product attributes.
- Adding option-list, range, regex, or unit conversion behavior.

## Acceptance Criteria

- Seller create/update rejects invalid spec data.
- Submit-for-review still blocks missing active required specs.
- Existing product update without `attributes` does not delete or revalidate historical inactive values unnecessarily.
- Tests cover create, update, and submit-for-review behavior.

## Verification

```bash
bunx vitest run server/modules/catalog/catalog.service.test.ts server/modules/catalog/catalog.routes.test.ts
```
