# Backend API Architecture

This document defines the backend API architecture for the marketplace. It complements `docs/ARCHITECTURE.md`, `docs/schema.dbml`, and the frontend planning documents.

## Goals

- Keep backend code domain-based and predictable.
- Preserve marketplace invariants: multi-shop orders, shipment split by shop, checkout stock reservation, webhook-only payment success.
- Keep API types inferred through Elysia, TypeBox/Prismabox, Eden Treaty, and TanStack Query.
- Keep trusted calculations and authorization on the server.

## Module Structure

Each backend domain lives under:

```txt
server/modules/<domain>/
  controllers/
  services/
  repositories/
  validators/
  dtos/
  errors.ts
  routes.ts
```

Recommended domains:
- `catalog`
- `cart`
- `checkout`
- `order`
- `payment`
- `shipping`
- `promotion`
- `inventory`
- `review`
- `seller`
- `admin`
- `chat`
- `notification`
- `auth`

## Layer Responsibilities

- **Routes/controllers**
  - Define Elysia routes.
  - Attach auth macros.
  - Validate request bodies, params, and query.
  - Convert service results into API responses.

- **Services**
  - Own business rules and transactions.
  - Coordinate repositories.
  - Enforce marketplace invariants.
  - Return typed domain results or throw domain errors.

- **Repositories**
  - Own Prisma queries.
  - Do not contain business workflows.
  - Keep query includes/selects explicit.

- **Validators/DTOs**
  - Use generated Prismabox schemas for Prisma-backed entities.
  - Compose schemas with `t.Pick`, `t.Partial`, and focused request schemas.
  - Do not hand-write duplicate Prisma model schemas.

## API Composition

- `server/index.ts` is the API composition root.
- `server/context/app-context.ts` wires services and shared dependencies.
- Routes receive `appContext`; services and repositories receive `appContext`.
- Use `appContext.logger`; do not use `console.log`.

## Auth and Authorization

Use route macros:
- `{ withAuth: true }`
- `{ withRole: "ADMIN" }`
- `{ withRole: "SELLER" }`

Authorization rules:
- Buyers can only access their own cart, checkout, orders, reviews, returns, chats, and addresses.
- Sellers can only access resources owned by their shop.
- Admin routes require admin role.
- Webhook routes require provider signature verification, not user session auth.

## Response Pattern

Recommended success response:

```json
{
  "data": {},
  "meta": {}
}
```

Recommended error response:

```json
{
  "error": {
    "code": "CHECKOUT_STOCK_UNAVAILABLE",
    "message": "Some items are no longer available.",
    "details": {}
  }
}
```

Use stable error codes for frontend handling. Do not rely on free-text messages for UI branching.

## Pagination

Use cursor pagination for feeds and large operational lists:
- product feeds
- search results
- order lists
- seller shipment queues
- admin tables
- chat messages

Common query fields:
- `cursor`
- `limit`
- `sort`
- domain filters

Common response metadata:

```json
{
  "meta": {
    "nextCursor": "string-or-null",
    "hasNextPage": true
  }
}
```

## Transactions

Use database transactions for:
- stock reservation
- checkout validation and reservation
- order creation
- payment webhook state changes
- stock commit/release
- shipment creation
- refund state transitions

Never split a business-critical state transition across independent writes unless the operation is idempotent and recoverable.

## Marketplace Invariants

- One order can contain items from many shops.
- Cart and checkout group items by shop.
- Order items store snapshots for product title, variant, price, and shop context.
- Shipping address is snapshotted on order creation.
- Stock is reserved during checkout before payment intent creation.
- Final stock is committed only after verified payment success webhook.
- Payment success is never inferred from browser redirects.
- Shipments are created per shop after order is paid.
- Seller shipment processing is scoped to seller-owned shop shipments.

## Logging

Log structured fields:
- `requestId`
- `userId`
- `shopId`
- `orderId`
- `checkoutId`
- `paymentId`
- `shipmentId`
- provider event id for webhooks

Do not log:
- full payment secrets
- auth tokens
- passwords
- full card/payment data
- private evidence files

## Backend Acceptance Checklist

- Every route belongs to a domain module.
- Protected routes use auth macros.
- Services enforce ownership and business rules.
- Repositories keep Prisma access isolated.
- Request validation uses TypeBox/Prismabox patterns.
- Error codes are stable.
- Checkout/payment/shipping state transitions are transactional or idempotent.
