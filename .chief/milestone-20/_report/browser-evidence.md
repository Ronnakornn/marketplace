# Milestone 20 Browser Evidence

Captured from clean Next dev origin `http://localhost:3010/en/search?q=bag&categoryId=fashion&minPrice=100&maxPrice=900&sort=price_asc`.

## Evidence Files

- `product-listing-search-desktop.png`
- `product-listing-search-mobile.png`
- `product-listing-filter-sheet-mobile.png`

## Runtime Checks

- Desktop listing contained `Sort by`, `Price Low`, `ACTIVE FILTERS`, `Category: Fashion`, `Price Range: 100 - 900`, and `Sort: Price Low`.
- Mobile listing contained `Filter and sort`, `3 active`, and active filter chips.
- Mobile sheet contained `Filter and sort`, `3 active filters`, `Sort by`, `Price Low`, facet groups, and `Clear filters`.
- No `localhost:3010` browser warning/error logs were observed in the active evidence tab.

Note: earlier `localhost:3000` browser tabs had stale cached Next dev chunks and emitted hydration mismatch logs. The final evidence used a clean origin after changing the sheet trigger to a native button.

