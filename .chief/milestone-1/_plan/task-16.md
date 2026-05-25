# task-16: Integrate category, brand, image metadata, and dimensions into seller product management UI

## Goal

Update `/seller/products` so sellers can manage production listing fields added by tasks 14 and 15.

## Scope

- Extend seller product hooks for new fields/endpoints:
  - category selection
  - brand selection
  - product image metadata create/edit/delete/primary
  - variant dimensions/weight
- Update product create/edit dialogs to include:
  - category selector
  - brand selector
  - image metadata management
  - publish readiness messaging for `ACTIVE`
- Update variant create/edit dialogs to include:
  - weight grams
  - length/width/height millimeters
- Display image/category/brand signals in the seller product table where useful.
- Keep image management URL/metadata-only.
- Keep full inventory editing on `/seller/inventory`.
- Preserve production readiness from task-11/task-12:
  - dirty-form protection
  - accessible labels/errors/actions
  - mutation error preserves form data
  - responsive table behavior

## Out of Scope

- Do not add file upload controls unless they only accept existing public URLs as metadata.
- Do not add admin brand management UI.
- Do not add shipping rate calculation.
- Do not refactor unrelated seller pages.

## Verification

- Add focused component tests for category/brand/image/dimension fields where practical.
- Add tests for publish readiness feedback where practical.
- Run focused seller product tests.
- Run `bunx tsc --noEmit`.
