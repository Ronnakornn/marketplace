# task-2: Extend tracking/cart backend to record product view and add-to-cart analytics events

## Objective

Ensure product views and successful add-to-cart actions are captured by backend analytics.

## Affected Areas

- `server/modules/tracking/**`
- `server/modules/cart/**`
- `server/context/app-context.ts`
- route tests and service tests

## Requirements

- Keep existing product view tracking backward compatible.
- If adding `product_viewed`, also keep existing product event types working.
- Record add-to-cart analytics only after cart add validation succeeds.
- Do not record failed add-to-cart attempts as successful add-to-cart events.
- Add-to-cart tracking must include product id, variant id, shop id, user id when authenticated, session id when available, quantity, source when available, and timestamp.
- Derive product/shop/variant context from trusted database data, not client-submitted shop id.
- Analytics write failure must not fail the cart add response.
- Log non-critical analytics write failures with `appContext.logger`.

## Implementation Notes

- Prefer adding repository/service methods instead of writing Prisma logic inside routes.
- Keep cart business behavior unchanged.
- If request body needs `sessionId` or `source`, validate it with TypeBox and keep it optional.
- Avoid introducing inline authorization logic.

## Required Tests

- Successful cart add records an add-to-cart analytics event.
- Failed cart add does not record analytics.
- Add-to-cart response still succeeds when analytics write fails.
- Existing product view/recently viewed tests still pass.

## Completion Criteria

- Cart add behavior is unchanged except for analytics side effect.
- Tracking remains backward compatible.
- Tests cover success, failure, and non-critical write failure behavior.
