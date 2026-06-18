# Product Detail Review and Q&A UI Contract

## Contract

Product detail must expose buyer-friendly review and Q&A discovery controls that are backed by the paginated review and question APIs.

## Review UI Requirements

- Show rating summary independently from the filtered review list.
- Provide controls for:
  - all ratings or one selected rating
  - all reviews / with media / with comment
  - latest / rating high / rating low
- Show active filter state clearly.
- Preserve existing review cards:
  - reviewer name
  - star rating
  - date
  - comment
  - media thumbnails
  - purchased item snapshot
- Provide a load-more or next-page action when `meta.hasNextPage` is true.
- Reset review pagination when review filters or sort change.

## Q&A UI Requirements

- Provide controls for:
  - all questions / answered / unanswered
  - latest / oldest
- Preserve existing ask-question form and authentication behavior.
- Preserve existing question cards and seller answer display.
- Provide a load-more or next-page action when `meta.hasNextPage` is true.
- Reset Q&A pagination when question filters or sort change.

## Data Fetching Requirements

- Use existing product query key conventions and TanStack Query.
- Review query keys must include product id, filters, sort, page, and limit.
- Question query keys must include product id, answer status, sort, page, and limit.
- Normalizers must accept the new paginated response shape and keep tolerant handling for older array-like test fixtures where reasonable.

## UX Requirements

- Controls must fit mobile and desktop without incoherent overlap.
- Empty states must reflect active filters where practical, without fake data.
- Error states must remain readable and retryable.
- Loading states must not remove already loaded pages during load-more fetches.

## Non-Goals

- Do not redesign product media, purchase panel, sticky buy bar, cart handoff, or checkout flow.
- Do not add review report/abuse UI.
- Do not add seller dashboard answer UX.
- Do not add review edit/delete/upload form changes.

## Acceptance

- Focused frontend tests cover review filter/sort controls, Q&A answered filter, load-more behavior, empty filtered state, and error retry.
- Browser evidence captures desktop and mobile product detail review/Q&A controls when local seed data allows it.

