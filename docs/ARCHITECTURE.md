# Architecture

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, Tailwind CSS, shadcn/ui |
| API Client | Eden Treaty, React Query |
| Backend | Elysia on Bun |
| Auth | Better Auth |
| ORM | Prisma v7 with PostgreSQL |
| Validation | Prismabox + TypeBox |
| Logging | Pino |

## Type Safety Chain

`prisma/schema.prisma` is the source of truth for database models and generated types:

```text
prisma/schema.prisma
  -> generated/client/     Prisma model and enum types
  -> generated/prismabox/  TypeBox validation schemas
  -> Elysia routes         typed handlers and validation
  -> Eden Treaty           frontend RPC types
  -> React Query           typed data hooks
```

Rules:
- Use Prisma-generated model types for database-backed data.
- Use prismabox schemas for route validation instead of hand-written model schemas.
- Infer frontend API response types from Eden Treaty.
- Keep generated output under `generated/` reproducible from Prisma.

## Marketplace Domain

The marketplace schema supports:
- Users, sessions, accounts, and verification records for Better Auth.
- Shops owned by users.
- Products, variants, and inventory.
- Carts, checkouts, inventory reservations, orders, and order items.
- Payments and payment webhook events.
- Shipments split by shop, with shipment items allocating order item quantities.
- Coupons, coupon redemptions, reviews, refunds, returns, chat, and notifications.
- Original sale funding and commission snapshots, explicit refund allocations, seller wallets, and payouts.

Important invariants:
- One order can contain items from many shops.
- Fulfillment is split into one or more shipments by `shopId`.
- Stock is reserved during checkout via inventory reservations.
- Payment success must come from a verified provider webhook event.
- Money is stored as bigint integer minor units; Prisma retains bigint, typed HTTP DTOs expose canonical integer strings, and UI formatters preserve exact digits. Counts/rates remain numbers; bounded operational/provider amounts use checked conversion. See [money design](numeric-money-design.md).
- Order items and shipping address fields keep snapshots so later catalog or address edits do not rewrite historical orders.

## Directory Structure

```text
prisma/
  schema.prisma
generated/
  client/
  prismabox/
server/
  index.ts
  context/app-context.ts
  lib/
  infrastructure/logging/
  modules/
    user/
app/
  layout.tsx
  page.tsx
  admin/
  features/
  components/
  lib/
docs/
  erd.md
  schema.dbml
  checkout-flow.md
  fulfillment-flow.md
```

## Backend Rules

- Keep `server/index.ts` as the API composition root.
- Wire services in `server/context/app-context.ts`.
- Keep backend domain code inside `server/modules/<name>/`.
- Use `{ withAuth: true }` and `{ withRole: "ADMIN" }` from the auth plugin for protected routes.
- Services and repositories receive `appContext` and use its logger.
- Keep browser API calls on same-origin `/api/*`; Next.js rewrites proxy to Elysia.

## Frontend Rules

- Keep routes in the Next.js App Router under `app/`.
- Keep feature code inside `app/features/<name>/`.
- Keep shared UI primitives in `app/components/`.
- Hooks should use Eden Treaty + React Query and invalidate related query keys after mutations.
- Do not duplicate backend response types on the frontend.

## Notification Delivery

`Notification` rows remain the source of truth. Foreground clients receive realtime events; opted-in devices may also receive best-effort Web Push for payment, shipping, and refund updates. Push subscription endpoints and keys are encrypted at rest, push failure never rolls back notification creation, and expired provider subscriptions are removed after `404` or `410` responses. The push-only service worker does not cache application or API responses.

## Commerce Workflow Modules

- `CheckoutQuoteEvaluator` is the single server-side calculation path for Checkout Quote preview and Order commitment. Its policy preserves the intentional difference between an unusable coupon in an estimate and in a commitment.
- Checkout commitment accepts one evaluated quote artifact and atomically creates the checkout, reservations, Order snapshots, shop orders, coupon/coin reservations, and Payment.
- Checkout creates `ShopSaleSnapshot` and `ItemSaleSnapshot`: zero-tax legacy inputs retain policy 1; nonzero tax or named coupon slots select policy 2. Named Shop/platform coupons apply in that order before coins. Legacy `couponCode` remains supported separately. Policy 2 requires the displayed quote fingerprint and tax revision; changed acceptance is rejected before commitment.
- `PaymentSettlement` concentrates verified payment transitions, inventory reservation handling, affiliate commission creation, and shipment creation behind the payment transaction seam.
- Buyer-facing shipment status and timeline projection lives in `server/modules/shipment/buyer-shipment-projection.ts` and is shared by Order and Shipment modules.

## Settlement Policy and Boundaries

[ADR-0005](adr/0005-discount-funding-and-refundable-commission.md) defines discount
funding and refundable commission. Shop coupons reduce seller merchandise rights;
marketplace coupons and coins reduce buyer cash while preserving those rights.
Commission excludes shipping and tax and uses the purchased rate and original fee.
Marketplace shipping subsidies preserve Shop entitlement; Shop-funded waivers
reduce it. [Policy 2](numeric-tax-design.md) freezes buyer/platform/coin NET/TAX,
gross seller receipts, buyer NET reward/affiliate bases and complete tax policy.
`Order.taxTotal` remains added tax; included and reported tax are separate fields.
Tax defaults to zero. Nonzero configuration explicitly selects rate, price mode,
funding basis and shipping treatment; no legal rate is inferred.

`CHECKOUT_V2_SETTLEMENT_ENABLED=true` gates new policy 2 admission. Evaluator and
admin tax-policy capability capture the flag at service construction, so changing
it requires replacement of every instance. Existing v2 sale processing remains
available when disabled; never roll code back before v2 support after v2 sales.
With a stored nonzero policy, flag-off rejects new checkout rather than silently
changing tax. See [checkout flow](checkout-flow.md) for configuration/acceptance.

Prisma models record the original settlement and reversal facts:

| Model | Responsibility |
|---|---|
| `ShopSaleSnapshot` | Original shipping NET/TAX and gross rights, NET commission base/rate/fee, frozen tax policy/revision, currency, version and recognition marker |
| `ItemSaleSnapshot` | Original quantity, advertised gross, coupon identities, buyer/platform/coin NET/TAX and original buyer NET reward/affiliate bases |
| `RefundItemAllocation` | Quantity interval and separate original cash/funding NET/TAX reversals |
| `RefundShopAllocation` | Shipping cause and NET/TAX reversals, original commission reversal and wallet posting marker |
| `AffiliateCommissionItem`, `AffiliateRefundReversal` | Immutable merchandise NET award bases and refund-linked cumulative original commission reversals |

Checkout writes sale facts in its commitment transaction. Refund plans use
positive quantities within remaining original rights. One PENDING/PROCESSING
plan holds an item; SUCCESS consumes quantities/components; confirmed FAILED
releases its held interval. Every atomic NET/TAX component uses a cumulative
original quantity interval, preserving final rounding cents. Different items may
hold plans concurrently; shipping capacities are also checked. Original commission
credits use cumulative successfully reversed merchandise NET and cannot exceed
the original fee. Cash alone does not identify refund scope.

Return mutations lock Order first and reread state. Approval creates a PENDING
refund with fixed approved quantities. SUCCESS closes linked Return as COMPLETED
atomically with economic effects; confirmed FAILED sets CANCELLED and releases
rights. Direct admin plans can change pending quantities; Return-linked plans
cannot change approved item scope. There is no automatic physical restock for a
delivered return, replacement coupon or goodwill. See [fulfillment flow](fulfillment-flow.md).

Wallet recognition still waits for a paid whole Order in DELIVERED or FULFILLED
state. It credits surviving merchandise and shipping rights after successful
pre-earning refunds and subtracts the surviving original commission. Gross
receipts include frozen tax; the NET commission base is not the seller credit.
Later refunds post entitlement debits and commission credits once. The ledger uses existing
`refund_adjustment` and `commission_fee` types; no separate debt table is added.
Seller debt derives from the signed ledger excluding reversible payout holds.
Future earnings offset it. Payout approval and marking paid lock the wallet and
reject a negative available ledger balance after refunds.

Settlement transactions lock Order, ShopWallets in Shop ID order, then
BuyerCoinWallet when used. Payout writers lock SellerPayout then ShopWallet and do
not acquire Order afterward. Replay, rights checks, inventory effects, wallet
posting, and buyer coin adjustments remain inside the relevant transaction.

Orders with no sale snapshots keep the validated legacy calculation path. Partial
snapshots or inconsistent histories produce a conflict, rather than guessing from
mutable coupons or current commission settings. Positive cash refund completion
records an external reference with two administrators; zero-cash completion uses
an internal settlement reference through the same field. Neither proves a real
provider transfer. The browser displays server-calculated amounts and requires
review of a refreshed PENDING plan before processing.

## Database Workflow

After editing `prisma/schema.prisma`:

```bash
bunx prisma format
bunx prisma validate
bunx prisma migrate dev --name <migration_name>
bun run db:generate
bunx tsc --noEmit
bun run test
```

Use `bunx prisma migrate deploy` for production or CI migration application.
