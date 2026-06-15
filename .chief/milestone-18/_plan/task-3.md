# task-3: Refine Reviews, Q&A, and Discovery Sections

## Objective

Improve lower product detail sections so buyers can evaluate social proof, ask/read questions, and continue product discovery with less visual friction.

## Primary Files

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- `app/features/product/components/ProductCard.tsx` only if required for local compatibility

## Implementation Notes

- Keep review and Q&A APIs unchanged.
- Preserve buyer-only question submission rules.
- Improve loading, error, empty, success, and populated states for reviews and Q&A.
- Keep question and answer text safely wrapped.
- Improve related and recently viewed section spacing/card rhythm using existing product card data.
- Preserve existing discovery tracking and recently viewed behavior.
- Do not add review submission, seller answer workflow, moderation, or recommendation engine work.

## Acceptance Criteria

- Review summary/list states are readable on mobile and desktop.
- Q&A form and list states are clear for guest and logged-in buyer states.
- Related and recently viewed sections remain compact and scannable.
- Empty/error states do not look broken or crowd other sections.
- Existing ProductCard and tracking behavior remain compatible.

## Verification

- Add or update focused tests for review/Q&A/discovery section states where fixtures support them.
- Include logged-in buyer content/trust browser evidence in task-4.
