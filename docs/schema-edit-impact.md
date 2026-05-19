# Schema Edit Impact: Seller Onboarding And Shop Ownership

## Scope Checked

- `prisma/schema.prisma`
- `prisma/production_hardening_indexes_constraints_full_marketplace_plus_ops_indexed.sql`
- Seller/auth/upload/frontend flow docs under `docs/`

## Main Schema Changes

- `Role` now contains only `USER` and `ADMIN`. Seller is no longer a platform role.
- Seller identity is represented by `SellerProfile`, `SellerApplication`, `Shop.ownerId`, active shop status, and future `ShopStaff` permissions.
- `Shop` now requires seller profile linkage, contact fields, seller identity hash support, more statuses (`REJECTED`, `BANNED`, `VACATION`), and soft-delete metadata.
- `SellerApplication` is now a first-class KYC/review workflow with encrypted identifier fields, shop contact fields, optional `sellerProfileId`, optional `shopId`, reviewer metadata, and `CANCELLED` status.
- `SellerKycDocument` links applications to `Upload`, adds document side/sort order, and enforces uniqueness per application/document side.
- `UploadUsage` includes `KYC_DOCUMENT` and `REVIEW_VIDEO`.
- `ReturnRequest.shopId` is required, so return flows are shop-scoped.
- Seller finance tables use `ShopWallet`, `WalletLedgerEntry`, `SellerPayout`, and `SellerTransaction` with BigInt money columns.
- Shop operations have new foundations for staff, settings, addresses, activity logs, restrictions, violations, and daily stats.

## Backend Impact

- Any code or tests checking `role === 'SELLER'`, `withRole: 'SELLER'`, or expecting `Role.SELLER` will fail against the current schema and generated types.
- Seller operations must resolve an active owned shop before product, inventory, shipment, return, promotion, wallet, payout, and seller chat actions.
- Buyer flows must allow users who own shops because seller capability no longer changes `User.role`.
- Admin seller approval must create/update `SellerProfile`, `Shop`, `ShopWallet`, `ShopSetting`, `ShopAddress`, and audit/activity logs in one transaction.
- Existing seller seed data needs migration from user role to seller profile + shop ownership.
- KYC storage must never return decrypted Thai ID, tax ID, company registration, or bank account numbers to clients.
- Upload validation must support KYC documents and review videos while enforcing owner, usage, status, content type, and file-size rules.
- Return service/repository code must treat `ReturnRequest.shopId` as required and enforce shop ownership from that column.

## Frontend Impact

- Role helpers must treat `USER` and `ADMIN` as the only platform roles.
- Seller navigation must include `/seller/register` and `/seller/status`.
- Operational seller pages must redirect:
  - no application/shop -> `/seller/register`
  - pending/rejected application -> `/seller/status`
  - active shop -> seller dashboard/tools
- Buyer shell must not hide cart/checkout/orders/reviews/returns/chat for users who also own active shops.
- Admin shops UI must include seller application queue, masked KYC summary, document review links, approve/reject controls, and rejection reason input.
- Eden inferred types must be regenerated and frontend hooks adjusted after schema/API changes.

## Data Migration Impact

- Existing `SELLER` role values need an explicit migration path before applying the new `Role` enum. Typical path: create `SellerProfile`, link shops, then convert user role to `USER`.
- Existing shops must be backfilled with `sellerProfileId`, `contactEmail`, `contactPhone`, and `sellerIdentityHash` where required.
- Existing return requests must have a valid `shopId`.
- Existing seller wallets/payouts/ledger entries must map old money columns to the current BigInt names.
- Existing KYC/application rows must be encrypted or masked before production use; plaintext identifiers should not survive migration.

## Production Hardening SQL Impact

The hardening SQL is not fully aligned with the current Prisma schema and should not be applied as-is.

Known mismatches:
- References old money column names: `balanceCents`, `pendingBalanceCents`, `withdrawableBalanceCents`, `amount`, `saleprices`, `originalprices`, `eligiblesubtotal`, `commissionCents`, `compensationCents`.
- Adds `ReturnRequest.shopId`, but the current schema already requires `shopId`.
- Lacks hardening for `SellerApplication`, `SellerKycDocument`, `ShopStaff`, `ShopAddress`, and KYC upload rules.
- Needs review around shop uniqueness because SQL creates soft-delete partial unique indexes while Prisma currently has normal indexes for shop slug/contact fields.
- Needs enum/status review for `ShopStatus`, `SellerApplicationStatus`, `UploadUsage`, and seller profile verification flow.

## Documentation Impact

- `docs/schema.dbml` is stale: it still includes `SELLER` role and does not reflect the current seller profile/application/shop staff schema.
- API docs must describe seller onboarding and admin review endpoints.
- Frontend flow docs must distinguish onboarding/status routes from active-shop operational routes.
- Testing docs should add migration, seller onboarding, active-shop authorization, KYC upload, and hybrid buyer/seller account cases.

## Open Decisions

- Whether v1 allows one shop per user or uses `SellerProfile.maxShopCount` and shop selection immediately.
- Whether shop staff permissions are in scope for the first seller launch or only schema groundwork.
- Whether admin approval should automatically create all default shop settings, pickup/return addresses, shipping provider defaults, and wallet rows.
- How to handle existing production `SELLER` role data if already deployed.
