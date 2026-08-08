# Milestone 28 TODO: Public Storefront Completeness

- [ ] task-1: Add the localized storefront data foundation
  - Add nullable Thai/English shop-description and policy fields through Prisma,
    regenerate generated clients/schemas, and preserve existing base fields.
  - Extend seller shop-profile/settings repository, service, validation, API,
    forms, cache invalidation, and focused ownership/fallback tests.

- [ ] task-2: Build the safe public storefront profile and identity surface
  - Add the public UUID-or-slug storefront endpoint with a strict public-field
    allowlist, localized fallback, real metrics, chat availability, and
    viewer-relative owner mode.
  - Render adaptive cover/logo states, real trust data, localized metadata,
    canonical slug, social image fallback, and owner/buyer actions.

- [ ] task-3: Complete the shop-scoped catalog and shared marketplace chrome
  - Make newest and minimum-active-variant price sorting work at the repository,
    then build URL-backed search, category facets, sorting, explicit load more,
    deduplication, retry, and terminal states on the storefront.
  - Reuse `BuyerTopBar`, extract the home mobile navigation for shared use, and
    render the shared `ProductCard` without redundant shop identity.

- [ ] task-4: Add storefront reviews, policies, chat, and funnel tracking
  - Add the backward-compatible paginated published-review feed, latest-review
    section, review anchor, and plain-text localized policy accordions.
  - Complete follow/chat/login handoff and direct room navigation, then track
    bounded shop views, product interactions, filters, successful follows, and
    successful chat opens without blocking buyer actions.

- [ ] task-5: Verify the complete storefront milestone
  - Add or update database, repository, service, route, query, component,
    navigation, i18n, SEO, analytics, authorization, and regression tests.
  - Run generation, typecheck, full tests, and i18n audit; capture Thai/English
    desktop/mobile browser evidence for media/no-media, owner/buyer,
    populated/empty/out-of-stock, and next-page failure states.
