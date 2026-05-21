# Context: Frontend Issue 002 Seller Route Guards And Navigation

## Scope

- Implemented seller frontend route guard behavior in `app/[locale]/seller/layout.tsx`.
- Added pure redirect helper and tests in `app/lib/seller-access.ts` and `app/lib/seller-access.test.ts`.
- Updated seller navigation shell in `app/features/seller/components/SellerShell.tsx`.
- No Prisma schema changes were required.

## Relevant Rules

- User roles are only `USER` and `ADMIN`; seller access must be derived from active shop/application state.
- Seller routes must work under localized paths `/th/...` and `/en/...`.
- Operational seller navigation should not appear on onboarding/status pages.

## Current Guard Semantics

- Active shop: `/seller/register` and `/seller/status` redirect to `/seller`; operational seller routes are allowed.
- No active shop and no application: operational/status routes redirect to `/seller/register`.
- Draft application: operational/status routes redirect to `/seller/register`.
- Submitted, rejected, cancelled, or approved-without-shop application: operational/register routes redirect to `/seller/status`.

## Data Shape Used By Guard

- `getSellerAccess()` loads:
  - authenticated session via Better Auth
  - active shops owned by the user: `shop.ownerId = user.id`, `shop.status = ACTIVE`
  - latest seller application for `sellerApplication.userId = user.id`
- `activeShop` is the first active shop by creation time.
- `activeShops` is exposed for multi-shop selector display when more than one active shop exists.

## Verification

- Run targeted test: `bunx vitest run app/lib/seller-access.test.ts`
- Run typecheck: `bunx tsc --noEmit`
