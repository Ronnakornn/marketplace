# task-5: Verification and Browser Evidence

## Objective

Complete milestone verification for buyer listing/search metadata UX, including automated tests and browser screenshots.

## Scope

- Backend tests touched by metadata/facet implementation.
- Frontend product listing/query tests.
- Browser evidence under `.chief/milestone-14/_report/`.
- Final autopilot/report notes when implemented.

## Required Verification

Run targeted verification:

```bash
bun run test server/modules/catalog server/modules/search app/features/product
bunx tsc --noEmit
```

Run full suite before completion:

```bash
bun run test
```

## Browser Evidence

Capture desktop and mobile screenshots for:

- search listing with results and load-more control
- search listing after category/brand/price filters are applied
- empty filtered result state with useful next actions

## Acceptance

- No visible `[object Object]` messages.
- No overlap in listing header, active filter chips, mobile sheet, or product grid.
- Product results remain visible if next-page load fails.
- Product grid remains usable if facet metadata is missing.
- Verification report records any environment dependency warnings, such as Redis availability, without hiding UI regressions.
