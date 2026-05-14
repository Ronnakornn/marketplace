# Buyer Marketplace Theme

This document defines the buyer-facing UI theme used by `MarketplaceHome` and all buyer routes.

## Scope

Applies to:

- `/`
- `/search`
- `/categories/*`
- `/products/*`
- `/cart`
- `/checkout`
- `/orders/*`
- `/profile`
- `/notifications`

Admin, seller, and backend-only screens do not inherit this theme unless explicitly requested.

## Visual Direction

The buyer experience should feel like a fast mobile-first commerce marketplace:

- bright white surfaces on a soft `#f7f8fb` page background
- orange commerce accents for primary actions, deals, active navigation, and price emphasis
- slate text for readability
- compact product cards designed for scanning and repeated shopping actions
- sticky mobile navigation and sticky purchase actions where useful

## Color Tokens

Use Tailwind utility colors consistently:

- Page background: `bg-[#f7f8fb]`
- Primary action: `bg-orange-600 hover:bg-orange-700 text-white`
- Price/action accent: `text-orange-600`
- Soft accent surfaces: `bg-orange-50 border-orange-100`
- Positive state: `emerald-*`
- Error state: `red-*`
- Body text: `text-slate-950`, `text-slate-700`, `text-slate-500`
- Card border: `border-slate-200`

Avoid buyer pages dominated by purple, beige, dark slate, or decorative gradients. Gradients are allowed only for product image placeholders or high-impact promotional panels.

## Shape And Layout

- Page max width: `max-w-6xl` for product/search surfaces, `max-w-5xl` for checkout/cart/order flows.
- Page padding: `px-3` on mobile, with bottom padding when sticky bars are present.
- Cards: use `rounded-3xl border border-slate-200 bg-white shadow-sm`.
- Small controls/badges: use `rounded-full` or `rounded-2xl`.
- Avoid nested cards. Use sections and repeated cards only.
- Product grids: `grid-cols-2` mobile, then `sm:grid-cols-3`, `lg:grid-cols-4` where space allows.

## Navigation

Buyer routes use:

- sticky top bar with rounded search entry
- notification and cart icon links
- fixed mobile bottom navigation

The `MarketplaceHome` bottom nav links must route to the same buyer pages as `BuyerPageShell`:

- Home: `/`
- Search/categories: `/search` or `/categories/*`
- Cart: `/cart`
- Account: `/profile`

## Commerce Actions

- Product cards link to `/products/{productId}`.
- Add-to-cart actions call buyer cart APIs and invalidate `buyer-cart`.
- Checkout actions use sticky bottom bars on mobile.
- Private buyer data must remain route-scoped and must not be cached globally.

## Copy

Use concise commerce copy. Thai copy is acceptable on buyer-facing screens, but files must be saved as UTF-8 and should not contain mojibake.
