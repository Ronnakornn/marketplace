# task-4: Finish Flash Sale Commerce Behavior

## Objective

Keep Flash Sale visually distinct while making sale actions safe and consistent with home cart handoff.

## Primary Files

- `app/features/marketplace/components/MarketplaceHome.tsx`
- `app/features/marketplace/queries.ts`
- `server/modules/discovery/` only if sale data must be extended for action safety.

## Implementation Notes

- Preserve custom Flash Sale card UI for urgency, progress, sale/original price, and sale timing.
- Guard progress math for zero, missing, or capped stock values.
- Add-to-cart should use the same mutation/feedback path as other home quick-add actions when the sale variant is safe to add.
- Route to product detail instead of guessing when sale data lacks safe cart inputs.
- Do not implement flash-sale admin/management features.

## Acceptance Criteria

- Flash Sale cards are stable on desktop and mobile rails.
- Sale progress and urgency are readable and do not rely on color alone.
- Safe sale quick-add succeeds with consistent feedback and cart invalidation.
- Ambiguous sale items route to product detail instead of attempting unsafe cart mutation.

## Verification

- Add/update focused tests for Flash Sale rendering, progress edge cases, safe add-to-cart, and fallback routing.
- Include visual evidence in task-5.
