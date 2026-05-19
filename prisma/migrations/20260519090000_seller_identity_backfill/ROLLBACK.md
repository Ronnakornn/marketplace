# Rollback Plan: seller_identity_backfill

This migration converts seller identity from `User.role = SELLER` into `SellerProfile` + `Shop.ownerId` + active shop state.

## Before Running

- Take a full database backup.
- Run first on a staging copy.
- Keep a copy of affected row counts:
  - users with old `SELLER` role
  - shops without `sellerProfileId`
  - return requests without `shopId`
  - shops without wallet/settings/address rows

## Rollback Strategy

Prefer restoring the pre-migration backup. The migration removes the `SELLER` enum value from `Role`, which is not safely reversible without knowing which users were sellers before migration.

If a backup restore is not possible:

1. Recreate the old role enum with `SELLER`.
2. Reassign seller users from `SellerProfile.userId` and shop owners back to `SELLER` only if that matches the pre-migration business decision.
3. Drop or ignore new seller identity tables only after dependent app code has been rolled back.
4. Revert `Shop`, `Product`, and `ReturnRequest` added columns only after dependent code no longer reads them.

## Manual Recovery SQL Sketch

```sql
ALTER TYPE "Role" RENAME TO "Role_current";
CREATE TYPE "Role" AS ENUM ('USER', 'SELLER', 'ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

UPDATE "User"
SET "role" = 'SELLER'::"Role"
WHERE "id" IN (
  SELECT "userId" FROM "SellerProfile"
  UNION
  SELECT "ownerId" FROM "Shop"
);

DROP TYPE "Role_current";
```

This sketch is intentionally incomplete because data loss risk depends on what code has run after migration. Use backup restore for production rollback.
