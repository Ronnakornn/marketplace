# Goal: Product Detail Review and Q&A Controls

## Outcome

Buyer product detail pages must expose clear review and Q&A discovery controls backed by the new paginated APIs.

## Scope

- Add review controls on product detail:
  - rating filter
  - media/comment filter
  - sort selector
  - load more or page continuation
- Add Q&A controls on product detail:
  - answered/unanswered filter
  - sort selector
  - load more or page continuation
- Preserve current rating summary, review cards, review media, purchased item snapshot, question form, and seller answer display.
- Keep empty, loading, error, and retry states readable on mobile and desktop.

## Constraints

- Use existing product feature query conventions and TanStack Query.
- Preserve same-origin `/api/*` routing.
- Do not manually duplicate backend response types when inferred types can be used.
- The UI must remain mobile-first and avoid text overflow.

## Non-Goals

- Do not redesign the whole product detail page.
- Do not change cart, checkout, seller, admin, or moderation flows.
- Do not add fake review/Q&A data for empty states.

