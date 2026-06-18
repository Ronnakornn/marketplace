# Product Detail Section Readability

## Goal

Make lower product detail sections easier to scan on mobile and desktop without changing the stable purchase flow from milestone 17.

## In Scope

- Media/gallery empty and populated states.
- Shop trust block layout and actions.
- Product facts and attributes layout.
- Description typography and long-text handling.
- Reviews and Q&A empty, loading, error, and populated states.
- Related/recently viewed section spacing and card rhythm.

## Out of Scope

- Reordering the entire page architecture.
- Replacing the product media model.
- New review submission or Q&A moderation workflows.
- New recommendation engine.

## Constraints

- Preserve existing route structure and same-origin `/api/*` behavior.
- Text must not overlap or be clipped on narrow mobile widths.
- No nested card-heavy redesign that conflicts with the current marketplace UI.
- Keep purchase controls usable and unobscured.
