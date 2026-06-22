# Task 5: Upgrade Buyer Teal/Green Accents and Lagoon Tokens

## Objective

Make buyer-facing teal/green accents high contrast instead of pastel or medium teal.

## Scope

- Update buyer-facing teal/green accent classes in:
  - `app/components/BuyerShell.tsx`
  - `app/features/marketplace/components/MarketplaceHome.tsx`
- Update light-mode lagoon tokens in:
  - `app/styles.css`

## Required Colors

- Use `text-teal-900` (`#134e4a`) or `text-emerald-900` (`#064e3b`) for buyer-facing teal/green accent text/icons on light backgrounds.
- Set light-mode buyer-facing tokens to:
  - `--lagoon: #0f766e`
  - `--lagoon-deep: #115e59`

## Out of Scope

- Do not change dark-mode tokens unless the implementation creates a contrast regression.
- Do not change admin cyan/galaxy classes or admin scoped CSS.
- Do not introduce new design token architecture.

## Verification

- Inspect diff and confirm admin files are untouched.
- Confirm token changes are limited to light-mode `:root` buyer-facing values.
