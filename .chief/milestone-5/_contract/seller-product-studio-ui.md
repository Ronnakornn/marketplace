# Contract: Seller Product Studio UI

## Layout

The product editor uses:

- persistent header with product title, status, save state, and primary actions
- section navigation for Basics, Category & Specs, Media, Variants, Inventory, Review
- responsive layout that works on mobile and desktop
- inline validation within each section

## Required Sections

Basics:

- title
- descriptions
- brand when available
- SEO/meta fields when available
- condition, warranty, origin when available

Category & Specs:

- primary category picker
- required and optional category specs
- filterable attributes surfaced from category definitions

Media:

- image upload/attach grid
- reorder controls
- primary image action
- alt text edit
- remove action
- one video slot

Variants:

- option axes editor
- option values editor
- generated variant table
- SKU, price, status, dimensions, and stock controls
- duplicate SKU and duplicate combination errors

Inventory:

- on-hand
- reserved
- available
- reorder level
- low-stock state
- movement history link or inline panel

Review:

- readiness checklist
- moderation status
- rejection reason when available
- submit-for-review action

## Rules

- Use Eden Treaty inferred API types.
- Use React Query for server state and mutation invalidation.
- Do not put product business logic in shared UI components.
- Save draft and submit review must show pending, success, and error states.
