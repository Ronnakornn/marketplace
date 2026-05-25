# Buyer Entry Performance Goal

## Objective

Reduce the user-visible initial render delay for buyer entry pages, starting with `/th` and `/th/search`.

## Scope

- Focus on buyer-facing entry paths:
  - marketplace home
  - search and product listing
- Cover route/render behavior, public product/category/search API latency, and client hydration only where measurement points to a bottleneck.
- Do not include cart, checkout, payment, seller, or admin performance in this extension unless a shared bottleneck directly blocks `/th` or `/th/search`.

## Success Criteria

- `/th` and `/th/search` should avoid long blank or loading states during initial navigation.
- Public product/category/search data fetching should avoid repeated work for equivalent locale/query/filter inputs.
- Buyer entry optimizations must not cache or expose private auth, cart, checkout, order, payment, or seller/admin data.

## Cache Policy

- Short-lived server/API caching is allowed for public product, category, and search results.
- Cache keys must include all behavior-changing inputs, including locale, query text, filters, sort, pagination, and category.
- Cache TTLs should be conservative and documented.
- Cache behavior must preserve product visibility/status rules.

## Verification Goal

- Capture before/after local evidence for `/th` and `/th/search`.
- Include both HTTP-level timing and browser-level visible render checks.
- Run focused tests for changed product/category/search cache behavior.
- Run `bunx tsc --noEmit`.
- Do not leave temporary diagnostics in production execution paths.
