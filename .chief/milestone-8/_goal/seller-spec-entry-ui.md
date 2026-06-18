# Goal: Seller Spec Entry UI

## Outcome

Seller product forms guide sellers to enter category specs using controls that match the active spec type.

## Scope

- Use active category spec definitions already returned to seller product forms.
- Render required and optional specs with type-aware controls:
  - `TEXT`, `SELECT`, `MULTI_SELECT`: text inputs or textarea-compatible controls.
  - `NUMBER`: numeric input.
  - `BOOLEAN`: select/toggle-style control.
- Show required-state and validation hints before submit.
- Continue supporting additional free-form specifications separately from category-defined specs.

## Out of Scope

- Rich enum option management.
- Drag-and-drop spec ordering.
- Bulk product spec editing.
- Product attribute migration UI.

## Success Criteria

- Seller UI no longer treats all category specs as plain text.
- Sellers can enter number and boolean specs without manually formatting text.
- UI tests cover type-aware spec controls and required-state behavior.
