# Product Analytics Data Model Contract

## Scope

Milestone 12 extends the existing tracking and commerce data so seller product analytics can be computed server-side.

## Existing Model Usage

- Use existing `ProductViewLog` for product view analytics.
- Keep existing `server/modules/tracking` behavior compatible with recently viewed products and discovery tracking.
- Do not duplicate product view tables unless the existing model cannot satisfy the implementation.

## Required Schema Additions

Add an add-to-cart analytics event model or equivalent persisted structure in `prisma/schema.prisma`.

Minimum fields:

- `id`
- `productId`
- `variantId`
- `shopId`
- `userId?`
- `sessionId?`
- `quantity`
- `source?`
- `metadata?`
- `createdAt`

Required indexes:

- `[productId, createdAt]`
- `[variantId, createdAt]`
- `[shopId, createdAt]`
- `[userId, createdAt]`
- `[sessionId, createdAt]`
- `[createdAt]`

## Trusted Commerce Data

Orders, units sold, and revenue must be derived from trusted order/order-item/payment data.

Revenue must not be accepted from analytics event payloads.

## Generation Requirement

After schema changes:

```bash
bun run db:generate
```

must run before typecheck, tests, or build.

## Non-Goals

- No real-time aggregation table is required in this milestone.
- No campaign/source attribution model is required.
- No admin analytics data model is required.
