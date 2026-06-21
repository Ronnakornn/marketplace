# Buyer Color Readability

## Goal

Improve buyer-facing text and icon readability by darkening light blue/teal accents that appear too faint on light mobile surfaces.

## Scope

- Applies to buyer-facing UI only, especially mobile header, bottom navigation, home shortcuts, and marketplace action chips.
- Keep the existing marketplace orange primary action color unchanged.
- Keep admin dashboard cyan/galaxy styling unchanged because it is designed for a dark surface.
- Prefer local design tokens or narrowly scoped class changes over broad palette changes that could regress unrelated pages.

## Success Criteria

- Mobile buyer navigation labels and icons are visibly darker on white or pale backgrounds.
- Buyer-facing teal/blue links and icon accents retain the current brand feel but have stronger contrast.
- No layout, routing, API, or backend behavior changes.
- Verification includes at least a typecheck and targeted visual inspection of buyer home/mobile navigation.
