# Task 3: Product Studio Category, Inventory, Review, and Moderation UX

## Goal

Complete Product Studio so sellers can satisfy readiness, manage stock visibility, submit for review, and understand moderation outcomes.

## Dependencies

- Milestone 4 category/spec APIs.
- Milestone 4 inventory APIs.
- Milestone 4 submit-review and moderation status APIs.
- Task 1 Product Studio shell.
- Task 2 media and variants sections.

## Affected Areas

- `app/features/catalog/**`
- `app/features/product/**`
- `app/features/seller/**`
- `app/features/inventory/**` if created
- frontend tests

## Required Work

1. Build Category & Specs section:
   - category picker
   - required specs
   - optional specs
   - inline validation
2. Build Inventory section:
   - variant inventory table or panel
   - on-hand
   - reserved
   - available
   - reorder level
   - low-stock state
   - movement history link or inline preview
3. Build Review section:
   - readiness checklist
   - submit-for-review action
   - blocked state with missing requirements
   - pending mutation state
4. Show moderation status and rejection reason when available.
5. Ensure submit review only becomes available when readiness checks pass.

## Acceptance Criteria

- Required category specs are visibly required and validated.
- Sellers cannot edit reserved quantity directly.
- Inventory available stock is displayed as derived state.
- Submit-for-review is blocked with clear missing checklist items.
- Rejection reason is visible in Product Studio after moderation.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- category/specs section desktop and mobile
- inventory panel desktop and mobile
- review checklist desktop and mobile
