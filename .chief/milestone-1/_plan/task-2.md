# task-2: Optimize seller route guard and shell rendering path

## Goal

Remove avoidable repeated route fetches and duplicate seller access work while preserving seller onboarding/operational routing behavior.

## Scope

- Review seller route guards, seller layout, and seller shell rendering.
- Ensure seller menu appears on operational routes and remains hidden on onboarding/status routes.
- Avoid route decisions that depend on unstable request headers when route params or client pathname are more reliable.
- Deduplicate server-side auth/session/seller access work within a request.

## Likely Files

- `app/lib/auth-server.ts`
- `app/lib/seller-route-guard.ts`
- `app/lib/seller-access.ts`
- `app/[locale]/seller/**/page.tsx`
- `app/[locale]/seller/layout.tsx`
- `app/features/seller/components/SellerShell.tsx`
- `app/components/BuyerShell.tsx`
- `app/components/Header.tsx`
- related tests under `app/**/*.test.tsx` or `app/**/*.test.ts`

## Steps

1. Confirm current seller access state transitions from `app/lib/seller-access.ts`.
2. Ensure redirects are deterministic for current route and locale.
3. Deduplicate request-scoped auth and seller access calls where safe.
4. Prevent protected seller links from causing unnecessary prefetch traffic when useful.
5. Add or update focused tests for seller routing/shell behavior.

## Verification

- `bunx tsc --noEmit`
- Focused seller access/routing tests pass.
- `/th/seller` renders seller navigation for active sellers.
- `/th/seller/register` and `/th/seller/status` keep onboarding/status behavior.
