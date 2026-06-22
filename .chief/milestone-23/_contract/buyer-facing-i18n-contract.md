# Buyer-Facing i18n Contract

## Contract

Buyer-facing pages and shared buyer-visible UI must render complete English and Thai text through the existing i18n system. The milestone must not change marketplace business behavior.

## Locale Model

- Supported locales remain:
  - `th`
  - `en`
- Locale routes remain `/<locale>/...`.
- `defaultLocale` remains `th`.
- `fallbackLocale` remains `en`.
- Locale-aware links must continue to use existing helpers such as `useLocalePath`, `withLocale`, or route-level locale utilities.

## Scoped Surfaces

The i18n completion scope includes:

- Public shopping surfaces:
  - home
  - search/listing
  - category listing
  - product detail
  - public shop page
  - deals page
- Buyer-authenticated surfaces:
  - cart
  - checkout
  - payment return
  - orders
  - order detail
  - order tracking
  - order review
  - return request
  - profile
  - addresses
  - wishlist
  - vouchers
  - followed shops
  - notifications
  - buyer chat
  - buyer affiliate/creator page
- Shared components used in those surfaces:
  - buyer shell/header/navigation
  - language switcher
  - buyer empty/loading/error states
  - cart handoff toast helpers
  - product cards and buyer-facing product controls

## Text Requirements

- Visible buyer-facing UI strings must use translation keys.
- This includes:
  - titles and section headings
  - CTA/action labels
  - empty, loading, error, retry, and success states
  - toast title and description text
  - form labels and placeholders
  - aria-label and screen-reader-only action text
  - status, stock, availability, and filter labels
- Do not translate:
  - product titles
  - shop names
  - user-generated chat/review/question content
  - order numbers
  - addresses
  - coupon codes
  - API-provided catalog values unless the API already provides localized values

## Message File Requirements

- `messages/en.json` and `messages/th.json` must have matching key structure for all keys used by scoped surfaces.
- New keys must be added to both files in the appropriate namespace.
- Thai values used by scoped surfaces must be readable UTF-8 Thai, not mojibake.
- English values should remain clear, concise, and action-oriented.
- Placeholder syntax must stay consistent across locales, for example `{count}`, `{amount}`, `{time}`, `{orderNo}`, and `{name}`.
- Existing i18n APIs may be extended only when needed for interpolation or auditability.

## Implementation Requirements

- Prefer existing `useTranslations`, `createTranslator`, `useFormatters`, and locale navigation helpers.
- Keep i18n migration scoped to frontend text and message files.
- Do not change API response schemas solely for localization in this milestone.
- Do not introduce a third-party i18n library.
- Do not redesign buyer layouts while replacing text.
- Keep text fitting in Thai and English on mobile and desktop.

## Audit Requirements

- Add an automated i18n audit for scoped buyer/public shopping files.
- The audit must check:
  - `messages/en.json` and `messages/th.json` key parity.
  - placeholder parity for matching message keys.
  - obvious hardcoded buyer-facing English UI strings in scoped files.
- The audit may allow documented exceptions for:
  - enum/status values that come from API data
  - test fixtures
  - CSS class names
  - import paths
  - URLs
  - analytics event names
  - product/shop/user-generated data
- The audit must be runnable through a deterministic command documented in the milestone report.

## Testing Requirements

- Update affected component tests when message keys or rendered labels change.
- Add or update focused tests for the i18n audit.
- Existing buyer/product/cart/checkout/order tests should continue to pass.

## Browser Evidence Requirements

- Capture English and Thai browser evidence for:
  - home or public shopping entry page
  - at least one authenticated buyer core page
- Evidence must include desktop or mobile screenshots sufficient to confirm text renders and layout does not obviously overlap.
- If local demo data lacks records for a populated state, capture the available empty/authenticated state and document it.

## Non-Goals

- No seller/admin back-office i18n completion except shared buyer-visible components.
- No translation management service.
- No currency, tax, or regional pricing changes.
- No backend business-rule changes.
