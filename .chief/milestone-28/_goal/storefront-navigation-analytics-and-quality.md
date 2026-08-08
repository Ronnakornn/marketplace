# Goal: Shared Storefront Navigation, Analytics, and Quality

## Outcome

The storefront behaves as a native marketplace surface, shares navigation with
the marketplace home page, and supplies trustworthy funnel signals without
making buyer actions depend on analytics delivery.

## Scope

- Reuse the marketplace home header and mobile bottom navigation as shared
  components; do not render the legacy AppChrome header or footer on shop
  routes.
- Use the section order: shop identity and trust, catalog, latest reviews, then
  shop policies, with an anchor from the rating summary to reviews.
- Track shop views, product impressions and clicks, storefront search/filter
  use, follows, and chat starts using bounded event metadata.
- Support anonymous session tracking under the existing discovery conventions
  without collecting chat text or unnecessary personal data.
- Verify responsive layout, keyboard access, visible focus, translated
  accessible names, error recovery, and both media-present/media-absent states.

## Success Criteria

- Home and storefront navigation use one implementation rather than copied JSX.
- Analytics failures never block navigation, product browsing, follow, or chat.
- A shop owner and a buyer receive the correct action set for the same shop.
- Automated type, unit/integration, i18n, and browser checks cover the critical
  storefront paths in Thai and English on desktop and mobile.

## Non-Goals

- Recording chat messages, policy text, or personally identifying search data in
  analytics events.
- Replacing the global analytics platform.
- Introducing a second storefront-only navigation system.
