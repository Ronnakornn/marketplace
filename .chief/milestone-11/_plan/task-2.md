# Task 2: Q&A Moderation Backend

## Goal

Extend content moderation backend to cover product questions and product answers.

## Inputs

- `_goal/q-and-a-moderation.md`
- `_goal/moderation-auditability.md`
- `_contract/content-moderation-api.md`
- `_contract/moderation-transition-rules.md`
- `_contract/moderation-audit-log.md`

## Required Work

- Add question queue listing with filters/pagination/product/shop/user context.
- Add answer queue listing with filters/pagination/question/product/shop/user context.
- Implement question status update transitions and required-note validation.
- Implement answer status update transitions and required-note validation.
- Add best-effort audit log calls for question/answer actions.
- Keep public Q&A behavior from milestone 10 unchanged except visibility rules covered in task 4.

## Verification

```bash
bun run test server/modules/content-moderation
bunx tsc --noEmit
```

## Out Of Scope

- Q&A reports, voting, threaded replies, or notifications.
- Seller answer ownership changes.
- Admin UI; handled by task 3.
