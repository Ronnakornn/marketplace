# task-27: Verify brand/product enrichment, seed safety, buyer filters, and type safety

## Goal

Complete final verification for the brand and product enrichment extension.

## Scope

- Review implementation against:
  - `brand-product-enrichment` goal
  - `brand-product-enrichment` contract
  - existing seller product CRUD contract
  - existing product UI data fetching contract
- Verify schema, API, UI, seed, and query behavior.
- Clean up temporary compatibility code only when safe.

## Implementation Notes

- Confirm brand CRUD is admin-only.
- Confirm sellers can select active brands but cannot mutate brands.
- Confirm public product visibility remains active-only.
- Confirm brand/attribute filters include behavior-changing inputs in query keys.
- Confirm seed scripts are non-destructive and clearly separated.
- Document any intentionally deferred items such as category attribute templates, advanced faceting, or brand landing pages.

## Verification

- Run Prisma format/validate/generate if schema changed in the batch.
- Run focused backend catalog/admin/search tests.
- Run focused frontend admin/seller/buyer product tests.
- Run focused seed verification.
- Run `bunx tsc --noEmit`.
- Record verification results and residual risks in the autopilot or milestone report.
