# Task 1: Review Backend Media Persistence

## Goal

Extend the existing review backend so buyer reviews can persist trusted image media through `ReviewMedia`.

## Inputs

- Goals:
  - `_goal/product-review-media.md`
- Contracts:
  - `_contract/review-media-api.md`

## Required Work

- Extend review create/update route bodies to accept `uploadIds?: string[]`.
- Keep existing `images?: string[]` compatibility only if needed, but do not trust raw URL strings for new media persistence.
- Extend `IReviewRepository` and `PrismaReviewRepository` to:
  - validate upload rows by id
  - create `ReviewMedia` rows for completed `REVIEW_IMAGE` uploads
  - replace review media on update when `uploadIds` is provided
  - include review media in review responses
- Extend `ReviewService` to enforce:
  - max review image count
  - completed upload status
  - `REVIEW_IMAGE` usage
  - upload owner matches review author
- Map responses to include `media[]`; keep `images[]` derived from persisted media if existing frontend code still expects it.

## Verification

- Update `server/modules/review/review.service.test.ts`.
- Add route tests if current review route tests are missing.
- Run:

```bash
bun run test server/modules/review/review.service.test.ts
bunx tsc --noEmit
```

## Out Of Scope

- Review video.
- Admin review moderation.
- New Prisma models.
