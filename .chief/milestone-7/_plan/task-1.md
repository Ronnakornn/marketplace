# Task 1: Schema and Repository Primitives

## Goal

Prepare the data layer for admin category/spec mutations.

## Affected Areas

- `prisma/schema.prisma`
- generated Prisma/prismabox output via `bun run db:generate`
- `server/modules/catalog/catalog.repository.ts`
- catalog repository tests if needed

## Required Work

1. Add spec definition fields if missing:
   - `CategoryAttributeDefinition.unit String?`
   - `CategoryAttributeDefinition.isActive Boolean @default(true)`
2. Add indexes needed for active/ordered spec reads.
3. Regenerate Prisma client and prismabox schemas.
4. Add repository methods for:
   - list admin categories including inactive
   - create category
   - update category
   - update category active state
   - reorder sibling categories
   - list category specs including inactive
   - create spec
   - update spec
   - update spec active state
   - reorder specs
5. Keep public/category assignment repository reads active-only.

## Out of Scope

- Route/controller implementation.
- Admin UI.
- Seller category request workflow.

## Acceptance Criteria

- Schema supports `unit` and `isActive` for category specs.
- Repository primitives are available for task-2 and task-3.
- No generated files are manually edited.

## Verification

```bash
bun run db:generate
bunx tsc --noEmit
```
