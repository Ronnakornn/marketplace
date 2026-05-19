# Backend Issue 001: Schema Migration And Backfill

Status: Implemented as migration artifact, pending staging database execution.

## Impact

The schema removed `SELLER` from `Role` and moved seller identity into `SellerProfile`, `SellerApplication`, and `Shop`. Existing data and code paths that rely on `User.role = SELLER` need migration before deployment.

## Tasks

- [x] Create migration for `Role` from old `USER/SELLER/ADMIN` to current `USER/ADMIN`.
- [x] Backfill `SellerProfile` for existing seller users.
- [x] Link existing shops to `sellerProfileId`, `ownerId`, `contactEmail`, `contactPhone`, and `sellerIdentityHash`.
- [x] Backfill `ReturnRequest.shopId`.
- [x] Backfill or create `ShopWallet`, `ShopSetting`, and default `ShopAddress` rows where required.
- [x] Define rollback plan for enum changes and required shop/profile columns.

## Artifacts

- Migration: `prisma/migrations/20260519090000_seller_identity_backfill/migration.sql`
- Rollback plan: `prisma/migrations/20260519090000_seller_identity_backfill/ROLLBACK.md`

## Implementation Notes

- Existing `SELLER` users and existing shop owners are captured into a temporary backfill set.
- `SellerProfile` rows are created for all former seller users and shop owners.
- Shops are linked to seller profiles and backfilled with contact fields.
- Product seller identity columns are populated from the owning shop.
- Existing shops receive wallet/settings rows and a placeholder pickup address marked with `BACKFILL_REQUIRED`.
- `ReturnRequest.shopId` is derived from returned order items. The migration intentionally fails if a return request is mixed-shop or itemless and cannot be resolved automatically.
- `User.role` and `AuditLog.actorRole` values of `SELLER` are converted to `USER` before the `SELLER` enum value is removed.

## Staging Verification

- Run the migration on a fresh staging clone before production.
- Confirm there are no users with `role = SELLER`.
- Confirm every shop has a valid `sellerProfileId`.
- Confirm every shop has a wallet and settings row.
- Confirm every return request has a `shopId`.
- Review placeholder pickup addresses with `line1 = 'BACKFILL_REQUIRED'`.

## Acceptance Criteria

- Existing seller accounts become normal `USER` accounts with seller profiles and owned active shops.
- No production row violates required `Shop`, `SellerApplication`, or `ReturnRequest` fields.
- Migration can run on staging without manual data edits.
