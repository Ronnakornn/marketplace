# Goal: Moderation Auditability

## Outcome

Every admin moderation action records an auditable decision without making moderation fail when audit logging is unavailable.

## Scope

- Use `AuditLogService.createAuditLogBestEffort` for every admin moderation action.
- Accept optional `note` on all actions.
- Require `note` for hide, reject, and report dismiss actions.
- Store available before/after status and target metadata in audit payloads.
- Keep audit logging best-effort and non-critical.

## Success Criteria

- Moderation still succeeds if best-effort audit logging fails.
- Audit payloads identify actor, entity type, entity id, before status, after status, and note.
- Tests cover audit calls where practical and failure-tolerant behavior where local patterns support it.
