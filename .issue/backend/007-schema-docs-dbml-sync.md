# Backend Issue 007: Schema Docs DBML Sync

## Impact

`docs/schema.dbml` is out of sync with `prisma/schema.prisma`. It still includes the old `SELLER` role and does not represent seller profiles, applications, KYC documents, shop staff, shop addresses, or current money column names.

## Tasks

- Update `docs/schema.dbml` from the current Prisma schema or regenerate it from a source-of-truth tool.
- Remove `SELLER` from the DBML role enum.
- Add `SellerProfile`, `SellerApplication`, `SellerKycDocument`, `ShopStaff`, `ShopStaffPermission`, `ShopAddress`, and current seller finance tables.
- Update renamed money fields to current BigInt field names.
- Re-check `docs/erd.md` against the updated DBML.

## Acceptance Criteria

- `docs/schema.dbml` matches current seller/auth/shop schema.
- No docs imply `User.role = SELLER`.
- ERD and DBML agree on seller onboarding and active shop ownership.
