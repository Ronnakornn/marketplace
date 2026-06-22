# Contract: Variant Matrix UI

## Option Axes

Rules:

- Maximum two option axes.
- Option axis names are editable.
- Option values can be added, deleted, and reordered.
- Removing an option value must show affected variants or require confirmation when variants exist.

## Variant Rows

Each generated row shows:

- option combination labels
- SKU
- price
- status
- dimensions
- stock summary
- row validation state

Bulk apply supports:

- price
- stock
- status

## Validation

- Duplicate SKU shows inline error.
- Duplicate option combination shows inline error.
- Missing SKU, invalid price, and negative stock show inline error.
- Inactive and out-of-stock variants have distinct visual states.

## Responsive Behavior

- Desktop uses a table or dense grid.
- Mobile uses stacked rows or horizontal-safe layout.
- Text and controls must not overlap.
