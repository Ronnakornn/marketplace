# Contract: Search and Listing UI

## Pages

Required page behavior:

- homepage product sections link to listing/search destinations
- category pages show category context and product listing
- search pages show query, suggestions, filters, sort, and results

## Filters

Supported filters:

- category tree or breadcrumb
- brand
- price range
- rating
- category specs or attributes
- in-stock
- shipping or promotion badges where data exists

Rules:

- Active filters are visible and removable.
- Filter state is reflected in URL query parameters.
- Mobile uses a filter sheet.
- Desktop uses a sidebar or equivalent persistent filter area.

## Sort

Supported sort values:

- relevance
- newest
- price low to high
- price high to low
- top sales
- rating

## Empty States

Empty states must offer at least one useful next action:

- clear filters
- try suggested keyword
- browse category
- view popular products

## Performance

- Results use pagination, cursor loading, or incremental loading.
- No page should request unbounded product lists.
