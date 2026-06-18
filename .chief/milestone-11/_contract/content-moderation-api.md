# Contract: Content Moderation API

## Module

Add an admin backend module for product UGC moderation, preferably `server/modules/content-moderation/`.

## Routes

All routes require `{ withRole: "ADMIN" }`.

### Queues

```txt
GET /api/admin/content-moderation/reviews
GET /api/admin/content-moderation/review-reports
GET /api/admin/content-moderation/questions
GET /api/admin/content-moderation/answers
```

Supported query:

```ts
{
  page?: number
  limit?: number
  status?: string
  q?: string
}
```

Responses use `{ items, pagination }` and include enough product/shop/user context for admin decisions.

### Actions

```txt
PATCH /api/admin/content-moderation/reviews/:reviewId/status
PATCH /api/admin/content-moderation/review-reports/:reportId/status
PATCH /api/admin/content-moderation/questions/:questionId/status
PATCH /api/admin/content-moderation/answers/:answerId/status
```

Body:

```ts
{
  status: string
  note?: string
}
```

## Status Rules

- Reviews use `ReviewStatus`.
- Review reports use `ReviewReportStatus`.
- Questions use `ProductQuestionStatus`.
- Answers use `ProductAnswerStatus`.
- Invalid transitions return stable `400` errors.
- Missing required notes return stable `400` errors.

## Public Visibility

- Public review APIs return only `PUBLISHED` reviews.
- Public Q&A APIs return only `PUBLISHED` questions and `PUBLISHED` answers.

## Verification

- Service tests cover queue listing, status transitions, invalid transitions, required note validation, and public visibility assumptions.
- Route tests cover admin-only access and stable error mapping.
