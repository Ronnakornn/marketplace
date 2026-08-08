# Contract: Storefront Navigation, Tracking, and Verification

## Shared Navigation

- Storefront and marketplace home render the same exported `BuyerTopBar`.
- Extract the home mobile bottom navigation into one shared marketplace
  component used by home and storefront; copied navigation JSX is prohibited.
- On `/shops/*`, no mobile item is falsely marked active.
- Shop routes bypass the legacy AppChrome header, extra main wrapper, and footer.
- Storefront content reserves safe-area bottom spacing while mobile navigation
  is fixed.

## Composition

Storefront section order is:

1. Adaptive shop identity, trust metrics, and viewer actions.
2. Searchable/filterable/load-more product catalog.
3. Latest published reviews with access to the review feed.
4. Non-empty shop description and policies.

The rating control links to the review section with keyboard focus preserved.

## Tracking Events

Add bounded storefront events to the existing discovery tracking pipeline:

- `shop_viewed`
- existing `product_impression` and `product_click` with storefront source
- existing `search_submitted` and `filter_applied` with storefront source
- `shop_followed` after a successful follow mutation
- `shop_chat_opened` after a room is successfully resolved

Persist shop interaction events using `ShopViewLog` with an explicit event type
or equivalently typed bounded metadata. The chosen representation must retain
existing shop-view records and indexes.

## Tracking Safety

- Tracking is fire-and-forget and never blocks browse, navigation, follow, or
  chat success.
- Query text uses the existing normalization and maximum-length rules.
- Do not record chat content, policy content, contact data, raw IP address, raw
  user agent, or arbitrary client metadata.
- Authenticated user ID and anonymous session ID follow existing tracking rules.

## Required Verification

- Prisma/service/route tests cover localization fallback, public-field
  allowlisting, inactive-shop denial, owner mode, chat availability, review
  publication filtering, review pagination, catalog sorting, and tracking.
- Component tests cover adaptive media states, shared navigation, URL filters,
  load-more deduplication/retry, owner/buyer actions, policies, and shared
  `ProductCard` behavior.
- Run Prisma generation after schema changes, then:

```text
bunx tsc --noEmit
bun run test
bun run audit:i18n
```

- Browser verification covers Thai and English, desktop and mobile, with at
  least: cover present, cover absent, populated catalog, empty catalog,
  out-of-stock product, owner view, buyer view, and next-page failure recovery.
