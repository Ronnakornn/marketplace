# Task 1: Review And Report Moderation Backend

## Goal

Implement backend moderation for product reviews and review reports.

## Inputs

- `_goal/review-report-moderation.md`
- `_goal/moderation-auditability.md`
- `_contract/content-moderation-api.md`
- `_contract/moderation-transition-rules.md`
- `_contract/moderation-audit-log.md`

## Required Work

- Update `prisma/schema.prisma` `AuditAction` enum with:
  - `REVIEW_STATUS_CHANGED`
  - `REVIEW_REPORT_STATUS_CHANGED`
  - `PRODUCT_QUESTION_STATUS_CHANGED`
  - `PRODUCT_ANSWER_STATUS_CHANGED`
- Run `bun run db:generate`.
- Add `server/modules/content-moderation/` repository, service, routes, errors, and index.
- Implement review queue listing with filters/pagination/context.
- Implement review report queue listing with filters/pagination/context.
- Implement review status updates with transition validation and required-note validation.
- Implement review report status updates with transition validation, required-note validation, and `RESOLVED_REMOVED` review-hide side effect when applicable.
- Wire service in `server/context/app-context.ts` and routes in `server/index.ts`.
- Add best-effort audit log calls for review/report actions.

## Verification

```bash
bun run db:generate
bun run test server/modules/content-moderation
bunx tsc --noEmit
```

## Out Of Scope

- Q&A moderation; handled by task 2.
- Admin UI; handled by task 3.
- Bulk actions or hard deletes.
