# Product Analytics Event Tracking

## Goal

Add lightweight backend event tracking for product views and add-to-cart actions so analytics can be computed from server-side records.

## Required Events

- Product view event.
- Product add-to-cart event.

## Event Context

Events should capture enough context to aggregate seller product analytics:

- Seller or shop identifier.
- Product identifier.
- Variant or SKU identifier when available.
- User identifier when authenticated.
- Session or anonymous visitor identifier when available.
- Event date/time.

## Constraints

- Event writes must be lightweight and safe for high-traffic product pages.
- Tracking must not block critical buyer flows if a non-critical analytics write fails.
- Do not expose analytics events across sellers.
- Avoid storing unnecessary personal data.
