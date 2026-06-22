# Contract: Verification

## Required Commands

Run after implementation:

```bash
bun run db:generate
bunx tsc --noEmit
bun run test
```

Focused tests must cover:

- category create/update/deactivate/reactivate/reorder service behavior
- spec create/update/deactivate/reactivate/reorder service behavior
- admin-only authorization for category/spec mutation routes
- public/seller endpoints hiding inactive categories/specs
- required active specs blocking product submit-for-review
- inactive specs not blocking product submit-for-review
- `/admin/categories` mutation UI states

## Browser Checks

Verify:

- `/admin/categories` desktop
- category create/edit/deactivate/reactivate
- spec create/edit/deactivate/reactivate
- inactive category/spec visual state

## Acceptance

- Full test suite passes.
- Typecheck passes.
- Prisma client and prismabox schemas are regenerated after schema changes.
- No generated files are manually edited.
- No public endpoint exposes inactive categories/specs.
