# Buyer Color Readability Contract

## Affected Surface

- Buyer-facing mobile shell and navigation:
  - `app/components/BuyerShell.tsx`
  - `app/features/marketplace/components/MarketplaceHome.tsx`
- Shared buyer-facing color tokens only when they improve light-surface readability without changing admin styling:
  - `app/styles.css`

## Color Rules

- Light blue/teal text and icon colors on light backgrounds must move to high-contrast dark values, not medium shades.
- Inactive mobile navigation text/icons must use `text-slate-900` unless a stronger semantic color is required.
- Buyer-facing teal/green accent text/icons on light backgrounds must use `text-teal-900`, `text-emerald-900`, or an equivalent hex value.
- Light-mode buyer-facing lagoon tokens should be darkened to approximately `#0f766e` for `--lagoon` and `#115e59` for `--lagoon-deep`.
- Active buyer navigation may keep orange as the primary state color.
- Admin-only cyan styling under `app/features/admin/**`, `app/[locale]/admin/**`, and `.admin-galaxy` must not be changed.
- Do not introduce a new color system or broad theme refactor.

## Behavior Rules

- No routing changes.
- No data fetching changes.
- No API or backend changes.
- No copy changes unless required by a color-only component refactor.

## Verification

- Run `bunx tsc --noEmit`.
- Inspect buyer home/mobile navigation and confirm icons and labels are darker and readable on white or pale backgrounds.
