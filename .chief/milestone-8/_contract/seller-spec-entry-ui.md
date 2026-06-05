# Contract: Seller Spec Entry UI

## Applies To

Seller product studio category/spec sections under:

- `app/features/seller/components/SellerProductPages.tsx`

## Data Source

- Use active category spec definitions already available from seller category/product data.
- Respect `attributeKey`, `displayName`, localized display names, `valueType`, `isRequired`, `isFilterable`, `unit`, and `sortOrder`.

## Control Mapping

- `TEXT`: text input.
- `NUMBER`: numeric input.
- `BOOLEAN`: select/toggle-style control with true/false values.
- `SELECT`: text input until option lists exist.
- `MULTI_SELECT`: comma-separated text input or textarea-compatible control until option lists exist.

## UI Behavior

- Required specs are visually marked and included in readiness checks.
- Type-specific helper text explains expected input for number, boolean, and multi-select.
- Category-defined specs write to the existing `attributes` payload.
- Free-form additional specifications remain separate and must not overwrite category-defined spec keys.
- UI validation is advisory; backend validation remains authoritative.

## Out of Scope

- Option-list widgets.
- Bulk spec editing.
- Product attribute migration UI.
- Rich faceted buyer filter UI.
