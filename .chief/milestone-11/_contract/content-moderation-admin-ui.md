# Contract: Content Moderation Admin UI

## Route

Add admin route:

```txt
app/[locale]/admin/content-moderation/page.tsx
```

## Navigation

Add a visible Admin sidebar/nav entry named `Content Moderation`.

## UI Requirements

- Use existing admin shell/components.
- Provide separate tabs or segmented views for:
  - Reviews
  - Review Reports
  - Questions
  - Answers
- Each queue supports status filter, search where useful, pagination, empty state, loading state, error state, and retry.
- Each row/card shows product, shop, author/reporter, status, created date, body text, and relevant context.
- Actions require confirmation for hide/reject/report resolution.
- Note input is required for actions that require notes by contract.

## Data Hooks

Add admin hooks under `app/features/admin/hooks/useAdminOperations.ts` or a focused admin moderation hook file if size becomes unwieldy.

## Verification

- Frontend tests cover queue rendering, required note validation, and mutation calls.
- Existing admin table tests remain passing.
