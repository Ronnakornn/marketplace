# Load More Browse UX

## Goal

Use load-more browsing for buyer listing/search results so mobile and desktop buyers can continue browsing without numbered page navigation.

## In Scope

- Load more control based on API `hasNextPage`.
- Append newly loaded products without losing existing scroll context.
- Clear loading and terminal states for additional pages.
- Retry behavior for failed next-page loads.
- URL/query behavior that preserves the base search and filter state.

## Out of Scope

- Infinite scroll auto-loading.
- Numbered pagination UI.
- SEO-specific page-number crawl strategy.

## Constraints

- Initial result load must remain usable without JavaScript-only hidden state.
- Additional loads must not duplicate products already shown.
- Loading more must not reset selected filters or sort.
