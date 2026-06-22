# Verification Contract

## Required Automated Verification

- Backend tests for listing/search metadata and facet response shape.
- Frontend query normalization tests for metadata, facets, and backwards-compatible item arrays.
- Frontend listing tests for:
  - exact result count display
  - load-more append behavior
  - load-more retry/error state
  - metadata-driven category/brand/price filter UI
  - empty state with clear filters or suggested category action

## Required Commands

Run after implementation:

```bash
bun run test server/modules/catalog server/modules/search app/features/product
bunx tsc --noEmit
```

Run full suite before milestone completion:

```bash
bun run test
```

## Browser Verification

Capture mobile and desktop evidence for:

- search listing with results and load-more control
- search listing after filters applied
- empty filtered result state

## Acceptance

- No visible `[object Object]` error messages.
- No text overlap in mobile filter sheet, listing header, active filter chips, or product grid.
- Product grid remains usable if facet metadata is missing.
