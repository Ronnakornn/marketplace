# Product Listing UX Audit

## Scope

- Reviewed `app/features/product/components/ProductListingPage.tsx`.
- Reviewed focused listing coverage in `app/features/product/components/ProductBuyerStates.test.tsx`.
- No backend, API, URL query, ranking, filter, or sort semantics changes are required.

## Current Pain Points

- Mobile filter entry opens the same sidebar content, but the sheet has little hierarchy beyond repeated filter blocks and does not expose sort choices inside the sheet.
- The mobile trigger does not summarize the active filtered state, so buyers must open the sheet or scan chips below the header to understand what is applied.
- Active filters render as plain outline buttons without a section label, compact wrapping behavior, or buyer-readable sort labels beyond raw query tokens like `price_asc`.
- The listing header uses a single flex-wrap row, which can crowd the title/count and horizontal sort tabs on narrow widths.
- Disabled facets are technically disabled with `aria-disabled`, but their visual treatment is subtle and does not communicate unavailable counts strongly.

## Polish Targets

- Add a clearer mobile filter/sort entry area with active filter count context.
- Reorganize the sheet content into a clearer mobile panel with sort, category, price, brand, rating, and service/promotion groups.
- Keep all links and price form fields wired to existing `buildSearchHref` and form query names.
- Improve active chip readability with labels, remove icons, horizontal scrolling on mobile, and clearer clear-all behavior that preserves `q`.
- Make the listing/search header stack predictably on mobile and keep desktop sort tabs usable.

## Risks

- Tests that query by exact link names may need updates because visible chip labels become more descriptive.
- Browser evidence may be blocked if the local dev server or data setup is unavailable; blockers should be recorded under the milestone report folder.
