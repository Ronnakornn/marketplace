# Task 4: Seller Product Studio Type-Aware Spec Inputs

## Goal

Update seller product studio category spec entry so sellers use controls that match spec `valueType`.

## Affected Areas

- `app/features/seller/components/SellerProductPages.tsx`
- `app/features/seller/components/SellerProductPages.test.tsx`
- `app/features/seller/hooks/useSellerManage.ts` only if type derivation needs adjustment

## Required Work

1. Extend category spec typing to include `unit` and normalized `valueType`.
2. Render controls by type:
   - `TEXT`: text input.
   - `NUMBER`: numeric input.
   - `BOOLEAN`: select or toggle with true/false values.
   - `SELECT`: text input until option lists exist.
   - `MULTI_SELECT`: comma-separated text input or textarea-compatible control.
3. Display helper text for number, boolean, and multi-select expected format.
4. Keep required specs visually marked and included in readiness checks.
5. Write category-defined attributes into the existing `attributes` payload.
6. Keep additional free-form specifications separate and available.
7. Avoid manually duplicating backend response types beyond local UI shaping already used in the component.

## Out of Scope

- Option-list widgets.
- Bulk spec editing.
- Product attribute migration UI.
- Buyer faceted filter UI.

## Acceptance Criteria

- Seller UI no longer renders every category spec as plain text.
- Number and boolean specs use type-aware controls.
- Required spec hints remain visible.
- UI tests cover number, boolean, required, and additional free-form behavior.

## Verification

```bash
bunx vitest run app/features/seller/components/SellerProductPages.test.tsx
```
