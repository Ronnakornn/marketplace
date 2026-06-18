# Task 5: Admin Product Moderation, Category UI, and Verification

## Goal

Build admin product moderation and category/spec management UI, then complete milestone frontend and browser verification.

## Dependencies

- Milestone 4 admin moderation APIs.
- Milestone 4 category/spec admin APIs.
- Existing admin shell/navigation conventions.

## Affected Areas

- `app/admin/products/**`
- `app/admin/categories/**`
- `app/features/admin/**`
- `app/features/catalog/**`
- frontend tests

## Required Work

1. Build `/admin/products` moderation queue:
   - status filters
   - search
   - product thumbnail/title
   - shop
   - category
   - readiness flags
   - submitted date
2. Build `/admin/products/:productId` moderation detail when needed:
   - media preview
   - basics
   - category specs
   - variants
   - inventory summary
   - shop context
   - moderation history
3. Add approve, reject, suspend, and restore actions.
4. Require non-empty reason for reject and suspend.
5. Build `/admin/categories` for category tree and spec management.
6. Add loading, empty, error, forbidden, and pending mutation states.
7. Run full frontend and browser verification.

## Acceptance Criteria

- Moderation queue filters pending, active, rejected, suspended, and archived products.
- Reject and suspend cannot submit without reason.
- Admin action mutations show pending and result states.
- Category UI can manage parent/child structure and spec definitions from APIs.
- Browser screenshots verify seller, buyer, and admin flows across required viewports.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- admin moderation queue desktop
- admin moderation detail desktop
- admin category/spec management desktop
- final smoke screenshots for seller editor and buyer product detail
