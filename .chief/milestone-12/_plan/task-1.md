# task-1: Add add-to-cart analytics data model and generate Prisma client

## Objective

Add the persisted data model needed to track successful add-to-cart analytics events.

## Affected Areas

- `prisma/schema.prisma`
- generated Prisma client
- schema-related docs only if architecture materially changes

## Requirements

- Add an add-to-cart analytics event model or equivalent persisted structure.
- Include at minimum:
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
- Add indexes:
  - `[productId, createdAt]`
  - `[variantId, createdAt]`
  - `[shopId, createdAt]`
  - `[userId, createdAt]`
  - `[sessionId, createdAt]`
  - `[createdAt]`
- Add Prisma relations to product, variant, shop, and user where appropriate.
- Do not duplicate `ProductViewLog`; use the existing model for views.

## Implementation Notes

- Prefer a model name that matches existing analytics naming, for example `ProductAddToCartLog`.
- Keep nullable fields intentional and minimal.
- Use Prisma as the source of truth; do not manually edit database tables.

## Verification

Run:

```bash
bun run db:generate
```

Then run at least:

```bash
bunx tsc --noEmit
```

## Completion Criteria

- Prisma schema compiles.
- Generated client includes the new model.
- No existing tracking or cart types break.
