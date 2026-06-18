# Task 2: Product Studio Media Manager and Variant Matrix UX

## Goal

Implement the Product Studio sections that manage product media and SKU variants.

## Dependencies

- Milestone 4 upload/media APIs.
- Milestone 4 SKU option matrix APIs.
- Task 1 Product Studio shell.

## Affected Areas

- `app/features/catalog/**`
- `app/features/product/**`
- `app/features/seller/**`
- frontend tests for media and variant UI

## Required Work

1. Build Media section:
   - file picker or drag/drop upload
   - pending/progress/completed/error states
   - image grid
   - reorder controls
   - primary image selection
   - alt text edit
   - remove image
   - one video slot with preview/replace/remove
2. Surface readiness warnings for missing primary image.
3. Build Variants section:
   - option axes editor with max two axes
   - option value add/delete/reorder
   - generated variant rows
   - SKU, price, status, dimensions, and stock fields
   - duplicate SKU and duplicate combination inline errors
   - small bulk apply for price, stock, and status
4. Add confirmation or clear warning before removing option values that affect variants.
5. Ensure mobile layout avoids table/control overlap.

## Acceptance Criteria

- Existing media remains visible if upload fails.
- Exactly one primary image can be selected.
- Video slot handles empty, pending, preview, error, replace, and remove states.
- Variant matrix rejects duplicate SKU and duplicate option combinations visibly.
- Inactive and out-of-stock variants are visually distinct.
- Variant matrix works on mobile and desktop.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Browser checks:

- media section desktop
- media section mobile
- variant matrix desktop
- variant matrix mobile
