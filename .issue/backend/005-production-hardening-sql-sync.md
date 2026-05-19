# Backend Issue 005: Production Hardening SQL Sync

## Impact

`prisma/production_hardening_indexes_constraints_full_marketplace_plus_ops_indexed.sql` references columns that no longer exist and is missing hardening for the seller onboarding schema.

## Tasks

- Replace old money columns:
  - `balanceCents` -> `balance`
  - `pendingBalanceCents` -> `pendingBalance`
  - `withdrawableBalanceCents` -> `withdrawableBalance`
  - `amount` -> `amount`
  - `saleprices` -> `salePrice`
  - `originalprices` -> `originalPrice`
  - `eligiblesubtotal` -> `eligiblesubtotal`
  - `commissionCents` -> `commission`
  - `compensationCents` -> `compensation`
- Remove or rewrite the `ReturnRequest.shopId` add-column block because schema already requires it.
- Add indexes/constraints for `SellerApplication`, `SellerKycDocument`, `ShopStaff`, `ShopAddress`, and KYC uploads.
- Review shop slug/contact uniqueness strategy with soft deletes.
- Run SQL in staging against a schema clone.

## Acceptance Criteria

- Hardening SQL runs cleanly on a fresh database generated from current Prisma schema.
- Hardening SQL runs cleanly on a migrated staging database.
- No constraint references missing columns.
