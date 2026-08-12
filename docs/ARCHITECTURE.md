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

Important invariants:
- One order can contain items from many shops.
- Fulfillment is split into one or more shipments by `shopId`.
- Stock is reserved during checkout via inventory reservations.
- Payment success must come from a verified provider webhook event.
- Money values are stored as integer cents.
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
