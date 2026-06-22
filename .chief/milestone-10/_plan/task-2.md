# Task 2: Product Q&A Backend

## Goal

Add backend support for public product questions, buyer question creation, and seller answers.

## Inputs

- Goals:
  - `_goal/product-q-and-a.md`
- Contracts:
  - `_contract/product-q-and-a-api-ui.md`

## Required Work

- Add a Q&A backend module, preferably `server/modules/product-question/`.
- Implement repository methods for:
  - finding active products with active shops
  - listing published questions with published answers
  - creating published buyer questions
  - finding questions with product/shop context
  - creating published seller answers
- Implement service rules:
  - public list only for active product from active shop
  - buyer question text is trimmed and required
  - seller answer text is trimmed and required
  - seller answer requires ownership of the product shop through existing active shop ownership helpers where practical
- Implement routes:
  - `GET /api/products/:productId/questions`
  - `POST /api/products/:productId/questions`
  - `POST /api/products/questions/:questionId/answers`
- Wire module into `server/context/app-context.ts` and `server/index.ts`.

## Verification

- Add service tests for list/create/answer/ownership failures.
- Add route tests for auth and error mapping.
- Run:

```bash
bun run test server/modules/product-question
bunx tsc --noEmit
```

## Out Of Scope

- Admin moderation.
- Reports, voting, nested replies, or notifications.
- Schema changes unless implementation proves existing schema unusable.
