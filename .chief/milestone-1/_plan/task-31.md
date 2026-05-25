# task-31: Integrate full product create/edit workflow

## Goal

Make the product create/edit pages capable of preparing a sellable listing in one workflow: basic product fields, category/brand, media, variants, dimensions, and simple stock setup.

## Scope

- Integrate product fields:
  - title, slug, description, status
  - localized titles/descriptions
  - category, brand
  - meta title/description
  - warranty, condition, country of origin
  - highlights and attributes
- Integrate image upload and management:
  - up to 10 images
  - primary image
  - alt text and ordering where supported
  - upload progress/error/retry/remove states
- Integrate product video upload:
  - one video
  - upload progress/error/retry/remove states
  - visible MIME/size validation feedback
- Integrate variants:
  - SKU, title, localized titles
  - price/currency
  - weight/dimensions
  - status if currently supported by API
  - create/edit/delete with confirmation for delete
- Integrate simple stock setup per variant:
  - editable `quantityOnHand`
  - editable `reorderLevel`
  - read-only `quantityReserved`
  - read-only available stock

## Affected Areas

- seller product form components
- `app/features/seller/hooks/useSellerManage.ts`
- catalog route/service contracts if gaps are found
- seller product component tests

## Implementation Notes

- Draft products can save without category, media, or variants.
- Active products should show clear readiness feedback before submit and must rely on backend validation as final authority.
- Product create may need to save a draft first before media/variant attachment; make that flow explicit and understandable.
- Avoid nested cards inside cards; use page sections and compact repeated item cards only where appropriate.
- On mobile, media grids, variant editors, and stock controls must not overlap or require tiny tap targets.
- Mutation failures must preserve entered form data.

## Verification

- Add/update tests for:
  - image limit UI validation
  - video one-file UI validation
  - media upload error display
  - variant add/edit/delete interactions
  - stock fields submit only allowed fields
  - active publish readiness messaging
  - mutation failure preserves form data where practical
- Run:
  - focused seller product component tests
  - `bunx tsc --noEmit`
