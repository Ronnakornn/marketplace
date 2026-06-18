# Product Filter Sort Sheet UX

## Goal

Make mobile Product Listing/Search filtering easier to understand, apply, revise, and clear.

## In Scope

- Filter/sort sheet layout and control hierarchy.
- Active filter chips and clear/remove interactions.
- Category, price, rating, stock, free shipping, sale, and sort controls already available in the frontend.
- Loading, disabled, and selected states for existing controls.

## Out of Scope

- Adding new filter dimensions.
- Changing URL query semantics.
- Changing API request parameters beyond existing UI wiring.
- Persisting new user preferences.

## Constraints

- Controls must not overflow or overlap on mobile.
- Active chips must remain removable and readable.
- Existing tests for product buyer states should stay meaningful.
- Do not introduce large new abstractions unless existing component structure requires it.
