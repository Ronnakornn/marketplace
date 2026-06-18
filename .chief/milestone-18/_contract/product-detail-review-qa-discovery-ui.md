# Product Detail Review Q&A Discovery UI Contract

## Purpose

Reviews, Q&A, related products, and recently viewed sections must support confident product evaluation and continued discovery without building new backend behavior.

## Reviews Contract

- Rating summary, review list, loading, error, and empty states must be readable.
- Review metadata and body text must wrap safely.
- Existing review API/query behavior must remain unchanged.

## Q&A Contract

- Buyer question form must keep existing auth and buyer-only rules.
- Q&A empty, loading, error, success, and populated states must be clear.
- Question and answer text must wrap safely.
- No new moderation, seller answering, or notification behavior is introduced.

## Discovery Contract

- Related and recently viewed sections must use existing product card data and tracking behavior.
- Empty/loading/error states must be readable and compact.
- Product card rhythm must stay usable on mobile and desktop.

## Boundaries

- Do not add a recommendation engine.
- Do not add review submission in this milestone.
- Do not change Q&A backend semantics.
- Do not duplicate backend response types on the frontend.
