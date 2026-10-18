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
- Chat messages own ordered verified attachment rows and immutable private objects. Participant downloads stream through the authenticated API. See [chat images and files](chat-attachments.md).
- Chat replies reference live sources. Logical deletion uses thread revisions, message versions, redacted projections, and bounded loaded-message refresh. See [chat message actions](chat-actions.md).
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

## Bounded product reads

Search, catalog price sorting, and seller product/SKU analytics rank and paginate
in PostgreSQL. Repositories return an exact total and page IDs/aggregates before
hydrating page details. Search ratings and sales use aggregates rather than loading
historical review/order-item arrays. Each reader retains its existing paid-sale and
cancellation policy. Analytics requires successful Payment evidence through EXISTS
and keeps monetary sums exact through PostgreSQL numeric and TypeScript bigint.
Analytics combines shop/date-scoped facts with candidate rows in one aggregate,
then excludes groups without a candidate label. This avoids repeated candidate
joins when PostgreSQL underestimates a newly populated shop. Selective product
queries still aggregate the authorized shop/date facts; database work remains
proportional to matching history even though application output is paginated.

Title/SKU ranking uses `marketplace_locale_compare`, an ICU en-US nondeterministic
collation managed by Prisma migration `20261012000000_locale_compare_ranking`.
It preserves Unicode-equivalent comparisons before the explicit date/ID tie keys.
PostgreSQL must support ICU; apply Prisma migrations before running this code.
Prisma's schema language does not model collations, so the schema records this
supporting SQL object in a comment and the migration owns its definition.

Visible product cards share authenticated favorite-status batches of at most
100 product IDs. Favorites remain private to the authenticated buyer; query keys
include the user ID and mutations update/invalidate the user's batch/detail keys.
Public product data does not contain favorite status.

Public catalog listings and related-product cards use a separate Prisma-derived
projection. It retains localized labels, all variant/options and stock facts
needed for quick-add, while omitting detail-only content. Ordered image URLs are
filtered for public assets before keeping the first valid image. Admin, seller
and product-detail readers retain their full projections. Public card caches use
a shape discriminator in the existing product-list invalidation namespace.

The product server loader uses `GET /api/products/:productId/boot` to receive the
canonical visible product and optional rating summary in one HTTP request. The
controller composes Catalog and Review readers; summary failure is logged and
does not replace a successful detail response. Existing detail and rating APIs
remain available. Request-scoped React.cache still shares the loader between
metadata and page rendering.

Client translation messages are selected structurally. The locale layout sends
public/shared messages with English fallback resolved on the server. Seller and
admin layouts add scoped messages through nested providers. Shared seller
dashboard and admin status labels remain available outside role layouts. A
same-locale nested provider merges messages; another locale does not inherit
the previous locale's values. Server translators retain the full dictionaries.

Cart mutations select only the active cart ID before locking, then hydrate the
cart after its Cart and CartItem locks. Update, delete and clear responses reuse
that locked snapshot and saved rows. First-cart creation retains its User-row
lock and recheck; an already consumed cart still rejects the mutation.
Cart reads share a Prisma-derived variant selection containing only consumed
product, variant and inventory fields. All cart/item scalars and ordered image
rows remain available to the existing locale, stock and buy-again logic.

Search and catalog facet caches omit pagination and sorting inputs. Search uses
the exact facet repository predicates; catalog retains all other listing
predicates. Both keep their existing search/product invalidation namespaces and
lossless money codec. A failed facet query returns its existing empty fallback
without storing that fallback in the shared facet cache.

Product metadata and page rendering share a request-scoped React.cache loader
of the Eden-inferred public detail and aggregate rating summary. The detail page
receives these as TanStack Query initial data, so dependent reads can start with
the canonical product ID. The loader uses no-store fetches, and SEO does not load
individual reviews.

Search and category routes fetch their first product page through typed Eden
with no-store and pass matching initial data to TanStack Query. Server and client
share request normalization, including locale and URL filters. A keyed listing
resets pagination when that identity changes; later pages cannot reuse page-one
initial data. A failed server fetch leaves the existing client query to recover.
Category and brand fallback queries are enabled independently only when the
displayed listing has no corresponding facet options. Populated listing facets
therefore supply filters without loading duplicate category/brand responses.

Route entrypoints import their feature components directly, keeping unrelated
address-editor data out of product grids and deals. Product cards disable automatic
route prefetch by default. Impression tracking observes cards inside the mounted
list and records each visible product once per source during that mount. Appending
a page observes its new cards; replacing an array with the same IDs does not
record another impression.

Redis pattern invalidation iterates SCAN cursors and bounded DEL batches, including
empty nonterminal scan pages. A shared connection promise prevents concurrent
cache reads from accumulating connection listeners. Existing failure cooldown,
pending-read generation checks, and inventory invalidation batching remain in place.
Each logical invalidation groups its patterns into one cursor traversal and filters
matching keys before bounded deletion. Single-pattern calls retain Redis glob
semantics; grouped generated patterns use literal key segments and `*` wildcards.

For newest/relevance search without rating or best-seller filtering, PostgreSQL
selects the product page before computing review, sales and variant metrics.
Metric-dependent sorts and filters evaluate each required aggregate across the
candidates. Display-only review or sales metrics aggregate after page selection.
Grouped metric CTEs are materialized to prevent repeated aggregation in nested
loops. Both paths keep the existing repeatable-read snapshot, count and cursor
semantics.

## Bounded operational reads

Buyer and seller orders, seller inventory and shipments use database pagination.
The query accepts `page` and `limit`, with a default page size of 20 and a maximum
of 50. Responses contain `data` and `meta` with the page, limit, total count, total
pages, and next/previous flags. Ownership, shop, search and status predicates apply
before page selection and count. Order and shipment lists use compact projections;
their detail endpoints retain snapshots and return/refund state.

Returns, payouts, coupon history, admin Flash Sale history, affiliate accounts and
affiliate links use the same page envelope. Return lists load only the latest
linked refund and omit order/payment history. Payout lists omit wallet relations;
financial reconciliation readers retain their full internal contracts. Public
coupon eligibility and the buyer's claimed-first order apply in SQL before
pagination. Affiliate admin rows return link counts instead of lifetime link arrays.
Voucher and creator history views load additional pages on demand. Discovery and
Deals use bounded coupon previews.

Chat inboxes use an opaque cursor over descending `(updatedAt,id)` pairs and return
`items` plus `pagination`. The repository applies participant, shop, search and
unread filters before selecting at most 50 rooms, then groups unread counts for
that page. `GET /api/chats/unread-count` separately counts every authorized unread
message, so header badges remain complete across pages. Both queries exclude
tombstones and preserve timestamp plus message-ID read boundaries. Buyer search
matches shops and the last visible message; seller search also matches the buyer.

Admin catalog tables use server search, title sorting and page metadata. Global
status cards use a separate aggregate that excludes soft-deleted products.
Recommendation cards aggregate qualifying sales and published reviews for the
selected products. Analytics daily and summary queries return grouped facts
instead of raw event or order-item histories, preserving the reporting calendar
and exact money sums.

Seller dashboard sales use exact database aggregates for lifetime and reporting
day/month totals. Admin dashboard and reports group repeated status counts and
money sums in PostgreSQL, preserving independent order/payment predicates and
exact bigint results. Active-shop seller counts remain distinct users.
Shipment statuses use grouped counts, and low-stock arithmetic
filters in PostgreSQL before returning qualifying variants. Existing reporting
calendar, ownership and complete low-stock response semantics remain unchanged.

Seller Flash Sale enrollment searches active products in pages of at most 50,
retains a selected variant while changing pages, and exposes product-query retry.
Each campaign keeps its own selection, scoped to the selected shop.

Guest cart login merge sends one stock-capped request per variant through
`POST /api/cart/guest-items`. The server keeps ordinary add-item validation strict
and returns the quantity actually added under the existing cart lock. The browser
retains unacknowledged quantities and additions made while requests are pending.
Merge requests carry the expected user ID, which must match the authenticated
actor before writes. One browser merge queue serializes the shared guest cart
across session changes and cancels obsolete sessions before later requests.
Unknown committed responses retain the existing retry ambiguity; this endpoint
does not promise idempotent replay. Header and inbox room queries share user/shop
scoped query options and freshness while retaining realtime recovery refreshes.
Only the header creates the periodic room-query interval; the inbox uses its
existing realtime recovery refreshes without adding another polling observer.

Notification lists return bounded pages with a cursor and server category/scope
filters. Unread badges use database counts; marking a scope read uses one database
update. The same seller scope predicate retains legacy notification classification
and constrains every operation to the authenticated user.
Notification cursors resolve an owned row inside PostgreSQL to preserve ordering
precision. A deleted or foreign cursor returns an empty terminal page; refreshing
the list starts pagination again.

## Notification Delivery

Collection pagination, payment cache ordering, event replay/admission limits,
WebSocket budgets and enabled Push transport bounds are specified in
[read and delivery bounds](read-and-delivery-bounds.md).

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

## Support conversations and appeals

The support module owns ticket, message, and dispute writes. Buyer and active-shop
owner scopes filter access in the repository. Private administrator notes are
excluded before public message pagination and counts. Seller projections do not
load order, payment, shipping address, or user contact relations.

Rejected-return appeals use nullable unique `DisputeCase.returnRequestId`.
Creation locks Order and returns an existing appeal on retry. Ticket mutations
lock Order before SupportTicket. Final decisions and administrator SYSTEM notes
commit atomically and have no financial or inventory effects. See
[support cases](support-cases.md) for API, access, and transition details.

## Full Admin control and operations

Admin access, configuration, reporting, directory and operations modules share a
closed permission registry while retaining domain ownership. The global guard
maps exact method/path pairs and rejects unknown administrative endpoints.
Membership changes and sensitive financial/catalog decisions use a shared
transaction lock and fresh permission checks. Existing user APIs protect the
final eligible owner.

Checkout freezes per-shop commission, shipping rule/provider and dispatch/delivery
SLA, and limits coupon allocations to eligible products/categories. Support
disputes link exact frozen refund plans; compensation becomes final only after
refund settlement succeeds. CSV/XLSX imports preview original facts and commit
atomically. Published CMS title/body remain frozen while drafts are edited.
See [Full Admin workflows](full-admin.md) for routes, worker setup and external
integration boundaries.

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
