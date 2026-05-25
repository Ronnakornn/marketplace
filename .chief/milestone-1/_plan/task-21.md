# task-21: Wire seller/admin/affiliate product reads and product mutation invalidation to the shared query helpers

## Goal

Bring protected product UI reads and product mutation refresh behavior into the shared query helper structure while preserving access boundaries.

## Scope

- Update seller product read hooks to use shared seller product query keys/helpers.
- Update admin product read hooks to use shared admin product query keys/helpers.
- Update affiliate product target lookup if it reads product records.
- Replace broad product-related invalidation with named invalidation helpers where practical.
- Cover seller/admin mutations that affect products, variants, images, inventory, or product visibility.

## Implementation Notes

- Seller reads must remain scoped to authenticated seller active shop access.
- Admin reads must remain admin protected.
- Do not expose seller/admin data in public query keys or public caches.
- Precise invalidation is preferred when product id/audience is known.
- Broad product-list invalidation is allowed when filter coverage makes precision unreliable.
- Keep non-product seller/admin hooks unchanged unless they are directly tied to product mutation refresh.

## Verification

- Add focused tests for seller/admin product query key usage where practical.
- Add focused tests for mutation invalidation helpers where practical.
- Update existing seller/admin product tests that mock old hooks.
- Run focused seller/admin/affiliate tests touched by this task.
- Run `bunx tsc --noEmit`.
