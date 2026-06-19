# Goal: Buyer-Facing Two-Language Completion

## Outcome

Buyer-facing shopping and account experiences must be complete in both Thai and English. Visible UI text in the scoped buyer surfaces must come from i18n keys, and Thai translations for those keys must render as readable UTF-8 Thai rather than mojibake.

## Scope

- Cover buyer core flow:
  - home and public shopping entry points
  - search, listing, category, product detail, public shop, and deals surfaces
  - cart, checkout, payment return, orders, order detail, tracking, returns, and review flow
  - profile, addresses, wishlist, vouchers, followed shops, notifications, chat, and affiliate buyer surfaces
- Move visible buyer-facing UI strings to translation keys:
  - page titles
  - CTAs and action labels
  - empty, loading, error, and retry states
  - toast text
  - aria-labels and screen-reader action text
  - status and availability labels
- Ensure each new or changed key exists in both `messages/en.json` and `messages/th.json`.
- Normalize Thai message values used by buyer/public shopping surfaces so they are readable UTF-8 Thai.
- Add automated i18n checks that guard key parity and obvious hardcoded buyer-facing UI strings.
- Capture EN/TH browser evidence for at least home and one authenticated buyer core page.

## Constraints

- Preserve the existing locale routing model using `/th` and `/en`.
- Preserve `defaultLocale = "th"` and `fallbackLocale = "en"` unless a contract explicitly changes them later.
- Do not change business behavior, pricing, inventory, payment, order, or authorization rules.
- Do not manually duplicate backend response types while migrating UI text.
- Keep Thai and English text fitting within existing mobile and desktop layouts.
- Avoid broad visual redesign; this milestone is localization completion, not a UX redesign milestone.

## Non-Goals

- Do not localize seller/admin back-office pages except shared components that are visible in buyer-facing surfaces.
- Do not add a translation management service.
- Do not add user-selectable currency or regional pricing.
- Do not translate user-generated content, product titles, shop names, order numbers, addresses, or API-provided catalog data.
- Do not add new product, checkout, or order features.
