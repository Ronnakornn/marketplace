# task-1: Polish Media, Assurance, and Shop Trust Sections

## Objective

Improve the top product detail trust surfaces so buyers can quickly understand media availability, marketplace assurances, and seller/shop context without disrupting the stable purchase controls from milestone 17.

## Primary Files

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`

## Implementation Notes

- Keep product detail code in `app/features/product/`.
- Polish the existing media/gallery area instead of replacing the product detail layout.
- Improve no-media and media/video states so they look intentional and readable.
- Refine the assurance strip for shipping, buyer protection, and returns using truthful existing/static copy.
- Refine the shop trust block so shop identity, location, chat, and follow actions are easy to scan.
- Do not add fake metrics or new backend trust data.
- Do not change Add to cart, Buy now, checkout, payment, or order behavior.

## Acceptance Criteria

- Media/no-media states are readable and visually stable on desktop and mobile.
- Assurance copy is compact, truthful, and does not crowd purchase decisions.
- Shop trust block has clear hierarchy and action placement.
- Long shop names or missing shop media do not cause clipping or overlap.
- Purchase decision panel and sticky buy bar remain usable.

## Verification

- Add or update focused tests for no-media/media trust section rendering where fixtures support it.
- Include desktop/mobile browser evidence in task-4.
