# task-2: Improve Sticky Buy Bar Responsiveness and Accessibility

## Objective

Make the sticky buy bar reliable as the buyer's persistent purchase surface across mobile and desktop.

## Primary Files

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`

## Implementation Notes

- Keep Add to cart and Buy now as primary actions.
- Keep labels readable and prevent button text overflow.
- Use responsive layout changes when secondary controls crowd primary purchase actions.
- Keep wishlist and chat seller controls available where they fit without reducing purchase action clarity.
- Preserve safe-area inset and page bottom padding.
- Keep purchase status associated with buttons via `aria-describedby` where practical.

## Acceptance Criteria

- Mobile sticky bar keeps Add to cart and Buy now tappable.
- Pending and disabled states are visually stable.
- Status, selected summary, quantity, and stock/error text remain readable.
- Sticky bar does not obscure product detail content or overlap form controls.

## Verification

- Add or update tests for accessible labels, `aria-describedby`, disabled reason titles, pending state, and responsive-safe text.
- Browser mobile screenshot is captured in task-4.
