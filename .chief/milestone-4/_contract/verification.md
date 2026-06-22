# Contract: Verification

## Required Tests

Backend tests:

- seller cannot edit another shop product
- seller cannot edit another shop inventory
- product submit review requires category, primary image, active priced variant, and required specs
- duplicate SKU combinations are rejected
- inventory reserve prevents oversell
- inventory commit and release update quantities and movement ledger transactionally
- admin moderation approve, reject, suspend, and restore enforce auth and status transitions

Frontend tests:

- seller product list handles loading, empty, error, and status filters
- seller product editor validates required sections before submit review
- variant matrix editor rejects duplicate combinations
- inventory panel displays on-hand, reserved, available, and low-stock states
- admin moderation queue performs approve/reject/suspend/restore flows

## Commands

Run after implementation:

```bash
bun run db:generate
bunx tsc --noEmit
bun run test
```

Run schema validation after Prisma edits:

```bash
bunx prisma format
bunx prisma validate
```
