# Goal: Complete Storefront Catalog and Buyer Actions

## Outcome

Buyers can browse the full active catalog of one shop, narrow it efficiently,
and continue into established marketplace purchase, follow, and chat flows.

## Scope

- Load the shop catalog in pages of 12 with an explicit load-more action.
- Search within the shop, filter by shop-specific category facets, and sort by
  newest, price ascending, or price descending.
- Preserve search, category, and sort state in the URL; debounce text search
  without creating a browser-history entry per keystroke.
- Append additional pages without duplicate products or losing active filters.
- Reuse the shared buyer product card while suppressing redundant shop identity
  inside a shop-specific catalog.
- Keep out-of-stock products visible with an explicit unavailable state.
- Open an existing buyer-shop room or create one, then navigate directly to the
  conversation; unauthenticated buyers first enter the login flow.
- Preserve the established follow, wishlist, and quick-add behaviors.

## Success Criteria

- Every active shop product is reachable without numbered pagination.
- All advertised sort choices change result order at the data source.
- Search, filters, sorting, and load-more behavior work on mobile and desktop.
- Loading, empty, terminal, and retry states are clear and translated.
- Shop owners cannot follow or initiate a buyer chat with their own shop.

## Non-Goals

- Infinite automatic scrolling.
- A shop-specific cart, pricing rule, or checkout flow.
- Hiding out-of-stock products from public routes or SEO.
