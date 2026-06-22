# Goal: Variant Matrix UX

## Outcome

Sellers can configure common marketplace SKU variants such as color and size without manually constructing every variant from scratch.

## Scope

- Support up to two option axes in this milestone.
- Allow adding, deleting, and reordering option values.
- Auto-generate variant rows from option combinations.
- Allow row editing for SKU, price, status, dimensions, and stock.
- Add small bulk apply actions for price, stock, and status.
- Do not implement CSV import or more than two option axes.
- Do not implement per-variant image mapping in this milestone.

## Success Criteria

- Duplicate SKU and duplicate option combination errors are shown inline.
- Removing an option value clearly shows impacted variants before saving.
- Out-of-stock and inactive variants are visually distinct.
- Variant matrix works on mobile and desktop without layout overlap.
