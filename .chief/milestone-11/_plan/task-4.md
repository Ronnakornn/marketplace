# Task 4: Public Visibility Regression Coverage

## Goal

Ensure public review and Q&A surfaces expose only published content after admin moderation actions exist.

## Inputs

- `_goal/content-moderation-scope.md`
- `_goal/review-report-moderation.md`
- `_goal/q-and-a-moderation.md`
- `_contract/content-moderation-api.md`
- `_contract/moderation-transition-rules.md`

## Required Work

- Review public APIs and product detail hooks from milestone 10.
- Ensure review list/rating summary exclude hidden/rejected reviews.
- Ensure Q&A list excludes hidden/rejected questions and hidden/rejected answers.
- Add regression tests for public visibility filters.
- Ensure admin mutations invalidate relevant product review/Q&A frontend query keys where hooks exist.

## Verification

```bash
bun run test server/modules/review
bun run test server/modules/product-question
bun run test app/features/product
bunx tsc --noEmit
```

## Out Of Scope

- New moderation actions.
- Admin UI changes beyond query invalidation support.
