# task-32: Verify seller product media and mobile UX

## Goal

Verify the end-to-end seller product management increment across backend contracts, frontend behavior, mobile usability, accessibility states, stock invariants, and type safety.

## Scope

- Run schema generation if schema changed.
- Run backend tests added for catalog media/upload validation.
- Run frontend tests added for seller product list/create/edit.
- Run typecheck.
- Manually inspect responsive behavior for list/create/edit pages.
- Check upload states for image and video.
- Check stock invariants: reserved stock is never editable or submitted from product forms.
- Check no generated files were manually edited beyond regeneration.

## Affected Areas

- `.chief/milestone-1/_report/task-32/` for verification notes if useful
- backend and frontend test suites touched by tasks 28-31

## Verification Commands

- `bun run db:generate` if Prisma schema changed
- `bunx tsc --noEmit`
- focused backend tests for catalog/upload
- focused frontend tests for seller product pages/components
- `bun run test` if focused tests are not enough to cover changed shared behavior

## Manual QA Checklist

- `/seller/products` works on mobile and desktop.
- `/seller/products/create` works on mobile and desktop.
- `/seller/products/[productId]/edit` works on mobile and desktop.
- Product list has clear loading, empty, error, and retry states.
- Create/edit page has accessible labels and visible validation errors.
- Image upload accepts valid images and blocks more than 10.
- Video upload accepts one valid `mp4`/`webm` and blocks invalid/second videos.
- Upload failures are visible and retryable.
- Active publish readiness explains missing category/image/variant requirements.
- Variant stock editor cannot update reserved stock.
- Archive/delete actions require explicit confirmation.

## Deliverable

- A short verification summary in the final builder report or `.chief/milestone-1/_report/task-32/verification.md` if the run is delegated.
