# Task 2: Darken Scoped Buyer-Facing Text/Icon Accents

## Objective

Apply scoped color changes so buyer-facing blue/teal text and icons are darker and easier to read on light backgrounds.

## Scope

- Update only the audited buyer-facing classes or buyer-facing global tokens.
- Preserve orange active/primary action states.
- Preserve layout, spacing, labels, routing, data fetching, and backend behavior.

## Implementation Notes

- Prefer darker Tailwind shades such as `text-slate-700`, `text-emerald-700`, `text-teal-800`, or existing `var(--sea-ink)` / `var(--lagoon-deep)` where appropriate.
- Avoid broad search-and-replace across admin components.
- Keep changes small and reviewable.

## Verification

- Check diff to ensure no admin files were changed.
- Confirm no non-color logic changed.
