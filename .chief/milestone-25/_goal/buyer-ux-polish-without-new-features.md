# Buyer UX Polish Without New Features

## Goal

Polish existing buyer-facing pages so they feel consistent, readable, and reliable without adding new product features, routes, APIs, database changes, or new business flows.

## Scope

- Applies to existing buyer-facing pages and components only:
  - profile
  - cart
  - checkout
  - orders and order detail/tracking/review/returns
  - chat
  - notifications
  - vouchers
  - wishlist
  - addresses
  - followed shops
- Improve only existing surfaces:
  - visual consistency
  - color/contrast readability
  - spacing and card radius consistency
  - mobile ergonomics
  - empty/loading/error state consistency
  - auth guard consistency for existing private buyer routes
- Do not add new feature capabilities, backend endpoints, routes, data models, or navigation destinations.

## Success Criteria

- Existing buyer pages use a more coherent visual system across cards, buttons, helper text, and shortcut panels.
- Buyer profile shortcuts and other light-surface controls use high-contrast colors consistent with milestone 24.
- Private buyer pages consistently require authentication before rendering private client-side API calls.
- Existing empty/loading/error states remain functional and visually consistent.
- Verification includes typecheck and focused tests for touched buyer components or route guards where available.

## Non-Goals

- New buyer features.
- New API endpoints.
- New database/schema changes.
- New checkout/payment/order business behavior.
- Admin or seller dashboard redesign.
