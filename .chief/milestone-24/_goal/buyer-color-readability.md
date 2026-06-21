# Buyer Color Readability

## Goal

Improve buyer-facing text and icon readability by changing faint blue/teal and inactive accents on light mobile surfaces to high-contrast dark colors.

## Scope

- Applies to buyer-facing UI only, especially mobile header, bottom navigation, home shortcuts, and marketplace action chips.
- Use clearly dark colors for buyer-facing light surfaces:
  - `text-slate-900` (`#0f172a`) for inactive/general icon and text states.
  - `text-teal-900` (`#134e4a`) or `text-emerald-900` (`#064e3b`) for teal/green accent states.
  - Dark light-mode lagoon tokens toward `#0f766e` / `#115e59` where shared buyer-facing links use them.
- Keep the existing marketplace orange primary action color unchanged.
- Keep admin dashboard cyan/galaxy styling unchanged because it is designed for a dark surface.
- Prefer local design tokens or narrowly scoped class changes over broad palette changes that could regress unrelated pages.

## Success Criteria

- Mobile buyer navigation labels and icons use high-contrast dark colors on white or pale backgrounds.
- Buyer-facing teal/blue links and icon accents are clearly dark, not pastel or faint.
- No layout, routing, API, or backend behavior changes.
- Verification includes at least a typecheck and targeted visual inspection of buyer home/mobile navigation.
