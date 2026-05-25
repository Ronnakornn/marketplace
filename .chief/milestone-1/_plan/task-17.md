# task-17: Verify production catalog fields, publish readiness, and migration/type safety

## Goal

Verify the schema/API/UI expansion for production catalog fields and document the remaining production gaps.

## Scope

- Run Prisma generation after schema changes.
- Run focused backend catalog tests added or touched by tasks 14 and 15.
- Run focused frontend seller product tests added or touched by task 16.
- Run `bunx tsc --noEmit`.
- If migrations are used in this repo state, verify the migration path or document the schema push expectation clearly.
- Inspect changed production paths for temporary logs, test-only helpers, or measurement-only code.
- Capture a short report under `.chief/milestone-1/_report/` summarizing:
  - schema changes
  - API changes
  - UI coverage
  - publish readiness behavior
  - tests run
  - known follow-up work

## Acceptance Checks

- `ProductImage` supports ordered image metadata and one primary image behavior.
- `Brand` supports global admin-managed brand selection.
- Products can reference category and brand.
- Variants can store normalized dimensions and weight.
- Draft products can save incomplete production listing fields.
- `ACTIVE` products require category, at least one image, and at least one active priced variant.
- Seller ownership checks remain enforced.
- No binary upload/S3/presigned upload flow was added.
- Typecheck passes.
