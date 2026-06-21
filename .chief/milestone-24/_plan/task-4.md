# Task 4: Upgrade Inactive Buyer Icons and Text to Slate 900

## Objective

Make buyer-facing inactive navigation and general light-surface icons/text clearly dark by using `text-slate-900`.

## Scope

- Update buyer-facing light-surface classes in:
  - `app/components/BuyerShell.tsx`
  - `app/features/marketplace/components/MarketplaceHome.tsx`
- Preserve active orange navigation/action states.
- Preserve layout, labels, routing, data fetching, and backend behavior.

## Required Color

- Use `text-slate-900` (`#0f172a`) for inactive/general icon and text states on white or pale backgrounds.

## Out of Scope

- Admin UI.
- Seller UI unless it is rendered inside buyer profile/home surfaces already covered by the files above.
- Any API or auth behavior.

## Verification

- Inspect diff and confirm medium slate shades such as `text-slate-600` / `text-slate-700` are not left on the targeted buyer inactive/icon text surfaces where the contract requires high contrast.
