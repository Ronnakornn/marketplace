# Task 3: Admin Content Moderation UI

## Goal

Build the admin Content Moderation route and operations UI.

## Inputs

- `_goal/content-moderation-scope.md`
- `_goal/review-report-moderation.md`
- `_goal/q-and-a-moderation.md`
- `_contract/content-moderation-admin-ui.md`
- `_contract/content-moderation-api.md`

## Required Work

- Add `app/[locale]/admin/content-moderation/page.tsx`.
- Add Admin sidebar/nav entry named `Content Moderation`.
- Add admin data hooks for moderation queues and status mutations.
- Build views for:
  - Reviews
  - Review Reports
  - Questions
  - Answers
- Add filters, pagination, empty/loading/error states, and retry.
- Add action dialogs with required note validation where required by contract.
- Ensure successful mutations invalidate moderation queues and affected public product review/Q&A queries where available.

## Verification

```bash
bun run test app/features/admin
bunx tsc --noEmit
```

## Out Of Scope

- Product listing moderation UI changes.
- Bulk moderation.
- New design system components.
