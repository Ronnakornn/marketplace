# Product Analytics Tracking API Contract

## Scope

Track product view and add-to-cart events needed for seller product analytics.

## Product Views

Existing discovery tracking can continue to record product views through:

```txt
POST /api/discovery/track
```

The implementation may add a clearer event type such as `product_viewed` if needed, but it must keep existing tracking event behavior backward compatible.

## Add-To-Cart Events

Add-to-cart analytics must be recorded when an item is successfully added to the cart.

Preferred behavior:

- Record inside the cart service after product/variant validation succeeds.
- Do not record failed add-to-cart attempts as successful analytics events.
- Do not block the cart mutation response if the non-critical analytics write fails.
- Use `appContext.logger` for any non-critical analytics write failure.

## Event Context

Add-to-cart events must include:

- Product id.
- Variant id.
- Shop id.
- Authenticated user id when available.
- Session id when available from request context or body.
- Quantity.
- Source when available.
- Created timestamp.

## Validation

- Validate product and variant ownership through trusted database records, not client-submitted shop id.
- Do not trust client-provided pricing or seller id.
- Reject malformed ids before writing analytics events.

## Tests

Required tests:

- Successful cart add records an add-to-cart analytics event.
- Failed cart add does not record an add-to-cart analytics event.
- Analytics write failure does not fail the cart add response.
- Product view tracking remains backward compatible.
