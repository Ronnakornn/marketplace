# Contract: Moderation Audit Log

## Schema

Add Prisma `AuditAction` enum values if they do not already exist:

```prisma
REVIEW_STATUS_CHANGED
REVIEW_REPORT_STATUS_CHANGED
PRODUCT_QUESTION_STATUS_CHANGED
PRODUCT_ANSWER_STATUS_CHANGED
```

Run `bun run db:generate` after schema changes.

## Audit Behavior

Every admin moderation status update calls:

```ts
AuditLogService.createAuditLogBestEffort({
  actorUserId,
  actorRole,
  action,
  entityType,
  entityId,
  before: { status },
  after: { status },
  metadata: { note, ...context },
  nonCritical: true,
})
```

## Requirements

- Audit creation is best-effort and must not block successful moderation.
- Audit payloads must not include secret or sensitive fields beyond moderation note and entity context.
- Tests should verify audit calls for representative actions and tolerate audit failures where practical.
