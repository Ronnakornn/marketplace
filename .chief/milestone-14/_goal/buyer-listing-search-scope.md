# Buyer Listing Search Scope

## Goal

Improve buyer listing and search UX so buyers can browse, understand result counts, refine results, and continue through product cards with less friction.

## In Scope

- Buyer product listing/search pages.
- Category and brand listing flows where they use the same product listing surface.
- Result count and query summary UX.
- Load-more browsing behavior.
- Filter and sort state visibility.
- Loading, empty, error, and partial metadata states.

## Out of Scope

- Product detail redesign already completed in milestone 13.
- Checkout/cart redesign.
- New recommendation engine.
- Full semantic search or typo-tolerant ranking.
- Seller/admin product management UX.

## Constraints

- Browser requests must stay same-origin `/api/*`.
- Frontend server state must use TanStack Query and Eden-inferred data.
- UI must remain marketplace-browse focused on mobile and desktop.
- Product cards must remain stable and not introduce layout shift.
