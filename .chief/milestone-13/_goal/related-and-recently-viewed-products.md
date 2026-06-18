# Related And Recently Viewed Products

## Goal

Add lightweight buyer product discovery sections that improve continuity around product detail without building a new recommendation engine.

## In Scope

- Related products section on product detail using existing or lightweight backend data.
- Recently viewed products section using existing tracking/recently viewed behavior where available.
- Empty and loading states.
- Mobile-friendly horizontal or responsive layouts.

## Out of Scope

- New recommendation engine.
- Personalized ranking beyond data already available or a small deterministic query.
- Campaign attribution.
- Admin recommendation controls.

## Constraints

- Related products should prefer same category, same shop, or similar available catalog data.
- Recently viewed must avoid exposing one user's browsing data to another user.
- Sections must not block the primary product detail content from rendering.
