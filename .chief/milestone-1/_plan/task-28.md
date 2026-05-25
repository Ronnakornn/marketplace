# task-28: Extend product media schema/API

## Goal

Extend catalog persistence and seller APIs so product media can be backed by completed local/module uploads while preserving existing product image URL compatibility and publish readiness rules.

## Scope

- Update `prisma/schema.prisma` only if existing models cannot satisfy the contract.
- Support upload-backed product images with an optional upload relation or equivalent persisted upload reference.
- Support one product video per product through a clean model or media table if `ProductImage` should remain image-only.
- Enforce:
  - max 10 images per product
  - max 1 video per product
  - video MIME types `video/mp4` and `video/webm`
  - video max file size 25MB
  - completed upload required before attachment
  - upload ownership belongs to the authenticated seller
- Preserve product publish readiness: `ACTIVE` requires category, at least one image, and at least one active paid variant; video does not satisfy the image requirement.
- Preserve archive semantics and seller ownership checks.

## Affected Areas

- `prisma/schema.prisma`
- `server/modules/upload/*` if a new product video upload usage is required
- `server/modules/catalog/catalog.repository.ts`
- `server/modules/catalog/catalog.service.ts`
- `server/modules/catalog/catalog.routes.ts`
- `generated/` via `bun run db:generate`
- Catalog service tests

## Implementation Notes

- Reuse the existing `Upload` model and `server/modules/upload` flow rather than creating product-specific binary upload endpoints.
- Prefer a media model that makes image/video constraints explicit if extending `ProductImage` for video would make naming or validation unclear.
- Keep public response data minimal; buyer detail can expose video metadata, list responses should avoid unnecessary media load unless already needed.
- Use TypeBox/Prismabox patterns for route validation.
- Do not expose storage keys or private upload internals in public product responses.

## Verification

- Add backend tests for:
  - attaching a completed image upload owned by the seller
  - rejecting incomplete image uploads
  - rejecting wrong-owner uploads
  - rejecting non-image uploads for images
  - rejecting the 11th image
  - attaching a valid product video
  - rejecting invalid product video MIME/file size
  - rejecting a second product video
  - publish readiness still requiring an image
- Run:
  - `bun run db:generate` after schema changes
  - `bunx tsc --noEmit`
  - focused catalog/upload tests
