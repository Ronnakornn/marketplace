# Contract: Homepage Merchandising UI

## Required Sections

Homepage uses these sections when data is available:

- banner carousel
- category grid or tree
- flash sale rail
- recommended products
- new arrivals
- featured shops
- recently viewed products
- voucher or promotion strip

## Behavior

- Sections render in a stable order.
- Each section supports loading, empty, error, and partial data states.
- Optional sections can be hidden when no data is available.
- Banners link to product, category, shop, promotion, search, or external destinations when allowed.
- Product rails use the milestone 6 product card contract.

## Rules

- Do not use mock-only blocks as the normal state.
- Do not implement homepage CMS or drag-and-drop layout editing.
- Use existing buyer shell and responsive layout conventions.
