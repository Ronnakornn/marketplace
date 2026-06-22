# Buyer Home Commerce Completeness

## Goal

Make the buyer home page feel complete as a commerce entry point, with coherent sections, clear actions, resilient states, and responsive layouts.

## In Scope

- Home hero, voucher strip, flash sale, categories, product rails, featured shops, recently viewed, sticky CTA, and mobile bottom navigation.
- Section-level loading, empty, error, and retry states.
- Responsive desktop and mobile quality with no text overlap.
- Buyer-facing copy and action hierarchy for browsing and shopping.

## Out of Scope

- Cart page redesign.
- Checkout redesign.
- Payment/order flow changes.
- Seller/admin home surfaces.
- Full recommendation algorithm redesign.

## Constraints

- Keep home business logic inside `app/features/marketplace/`.
- Reuse existing discovery/home APIs where practical.
- Do not trust client-provided pricing or stock.
- Do not introduce a mini cart drawer.
