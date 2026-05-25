# task-20: Remove production demo product fallback states from buyer product UI and verify real empty/error/loading states

## Goal

Ensure buyer-facing product UI represents real API state instead of showing demo products as real inventory.

## Scope

- Remove production-path demo/fallback product feeds from buyer product UI.
- Replace fallback behavior with project-standard loading, error, and empty states.
- Cover buyer product surfaces migrated in task-19, especially marketplace home and product listing/deals pages.

## Implementation Notes

- Demo data may remain only in tests, stories, fixtures, or explicitly development-only helpers if the codebase already has a safe pattern for that.
- Add-to-cart buttons must not appear for fake products in production paths.
- Empty states should make clear that no products are available for the current filters/search.
- Error states should provide a retry path where the page can stay interactive.
- Do not redesign product pages beyond state handling.

## Verification

- Add focused UI tests proving empty API responses show empty states, not demo products.
- Add focused UI tests proving API failures show error states with retry where practical.
- Run focused buyer product UI tests.
- Run `bunx tsc --noEmit`.
