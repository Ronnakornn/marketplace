# Task 5: Admin Product Moderation, Category Specs UI, and Milestone Verification

## Goal

Build admin screens for product moderation and category/spec management, then run final milestone verification.

## Affected Areas

- `app/admin/**`
- `app/features/admin/**`
- `app/features/catalog/**`
- frontend tests
- docs if public architecture changes need updates

## Required Work

1. Add or update `/admin/products` moderation queue.
2. Add `/admin/products/:productId` detail/moderation screen if needed.
3. Support approve, reject, suspend, and restore actions.
4. Require reason input for reject and suspend actions.
5. Add or update `/admin/categories` for category tree and spec management.
6. Validate category delete constraints through API behavior.
7. Run full milestone verification commands.
8. Update architecture docs only if implementation changes documented architecture contracts.

## Acceptance Criteria

- Admin routes and API calls are protected by admin auth behavior.
- Moderation queue filters by pending, active, rejected, suspended, and archived statuses.
- Admin category UI can manage parent/child categories and spec definitions.
- Reject/suspend actions persist reasons visible to seller product UI.
- Full typecheck and tests pass or documented failures are reported with blockers.

## Verification

```bash
bun run db:generate
bunx tsc --noEmit
bun run test
```

Use Browser/Playwright verification for admin moderation and category/spec flows after implementation.
