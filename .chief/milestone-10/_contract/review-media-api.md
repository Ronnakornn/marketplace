# Contract: Review Media API

## Existing Module

Extend `server/modules/review/`.

## Review Create/Update Inputs

`POST /api/reviews`

```ts
{
  orderItemId: string
  rating: number
  comment?: string
  uploadIds?: string[]
}
```

`PATCH /api/reviews/:reviewId`

```ts
{
  rating?: number
  comment?: string | null
  uploadIds?: string[]
}
```

## Upload Rules

- `uploadIds` must reference existing completed `Upload` rows.
- Upload usage must be `REVIEW_IMAGE`.
- Upload owner must match the authenticated buyer unless actor is admin.
- Review video is out of scope.
- Keep a bounded image count. Use 5 images unless existing constants require a smaller limit.

## Persistence

- Persist media through `ReviewMedia`.
- `ReviewMedia.reviewId` must point to the review.
- `ReviewMedia.uploadedById` must be the review author.
- `ReviewMedia.type` must be `IMAGE`.
- `url`, `mimeType`, `sizeBytes`, and filename-derived metadata must come from the completed upload.
- Replacing `uploadIds` on update replaces the review media set.

## Response Shape

Review responses include:

```ts
media: Array<{
  id: string
  type: "IMAGE"
  url: string
  altText: string | null
  sortOrder: number
  width: number | null
  height: number | null
  mimeType: string | null
  sizeBytes: number | null
}>
```

Keep `images: string[]` only if needed for backward compatibility, populated from `media.url`.

## Verification

- Unit tests cover completed upload validation, wrong owner, wrong usage, pending upload, media replacement, and response mapping.
- Existing review tests remain passing.
