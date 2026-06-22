# task-2: Improve Product Facts and Description Scanability

## Objective

Make product facts, attributes, warranty/origin/condition, and descriptions easier to scan while preserving missing-data behavior.

## Primary Files

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`

## Implementation Notes

- Reuse existing normalized product fields.
- Show only facts and attributes that exist.
- Preserve empty-state copy when a product has no highlights, facts, attributes, or description.
- Improve long text wrapping for labels, values, attributes, and descriptions.
- Keep visual density marketplace-oriented: organized, scannable, and not marketing-heavy.
- Do not add schema/API fields.

## Acceptance Criteria

- Product facts section is readable when data is present.
- Missing facts do not create awkward empty panels.
- Long attribute names/values wrap safely.
- Description supports long text and line breaks without clipping.
- Mobile layout remains readable above the sticky buy bar.

## Verification

- Add or update focused tests for populated facts/attributes and missing-data states where fixtures support them.
- Include browser evidence in task-4.
