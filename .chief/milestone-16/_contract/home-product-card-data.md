# Home Product Card Data Contract

## Purpose

Home product rails must use the same buyer product-card behavior as listing/search without duplicating independent card logic.

## Product Rail Contract

- Recommended, New Arrivals, and Recently Viewed rails should render through the reusable buyer `ProductCard` when enough product data exists.
- Home data must be normalized into the reusable card's buyer product shape at the feature boundary.
- Normalization must preserve product id, slug/title, images, price range, currency, rating, sold count, stock state, shop identity, badges, and variant information needed for quick-add eligibility.
- If an API response lacks data needed for unambiguous quick-add, quick-add must be disabled or omitted rather than guessing.

## API/Data Rules

- Prefer existing discovery/recommendation APIs and Eden-inferred response types.
- Do not manually duplicate backend response types in frontend code.
- Backend may extend home/discovery DTOs only when needed to support buyer card behavior.
- Client display data must not become a pricing or stock authority; cart mutation results remain the source of truth after buyer actions.

## Card Behavior Rules

- Reusable product cards must own favorite behavior, navigation tracking, quick-add disabled states, login handoff, and add-to-cart feedback.
- Home rail wrappers may pass contextual labels or analytics context, but must not fork card interaction logic.
- Flash Sale cards may remain custom because they have sale-specific urgency/progress UI.

## Boundaries

- Do not rework product detail pages.
- Do not rework seller storefront cards.
- Do not replace all home visuals with generic product cards.
