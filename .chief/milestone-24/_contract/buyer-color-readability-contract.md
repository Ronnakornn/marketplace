# Buyer Color Readability Contract

## Affected Surface

- Buyer-facing mobile shell and navigation:
  - `app/components/BuyerShell.tsx`
  - `app/features/marketplace/components/MarketplaceHome.tsx`
- Shared buyer-facing color tokens only when they improve light-surface readability without changing admin styling:
  - `app/styles.css`

## Color Rules

- Light blue/teal text and icon colors on light backgrounds must move to darker values.
- Inactive mobile navigation text/icons must be darker than the current faint gray/teal appearance.
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
