# Buyer UX Polish Contract

## Allowed Files and Surfaces

Implementation may touch existing buyer-facing route pages and components, including:

- `app/[locale]/(buyer)/**/page.tsx`
- `app/features/buyer/components/**`
- `app/features/cart/components/CartPage.tsx`
- `app/features/checkout/components/CheckoutPage.tsx`
- `app/features/order/components/**`
- `app/features/chat/components/**`
- shared buyer shell/state components only when needed:
  - `app/components/BuyerShell.tsx`
  - `app/components/BuyerState.tsx`

## Allowed Changes

- Improve color contrast for existing text, icons, outlines, and helper copy on light surfaces.
- Normalize visual patterns that already exist:
  - card radius
  - borders
  - spacing
  - shortcut/action button styling
  - mobile sticky footer readability
  - empty/loading/error presentation
- Add missing `requireUser()` guards to existing private buyer route pages that already fetch private user data.
- Add or adjust focused tests for touched components or route guards when existing tests are present.

## Forbidden Changes

- No new features.
- No new routes or navigation destinations.
- No new backend endpoints.
- No database or Prisma schema changes.
- No checkout, payment, order, inventory, seller, admin, or auth business logic changes.
- No new third-party UI library or design system rewrite.
- Do not change admin or seller dashboard styling except where an existing buyer page links to seller status/chat as part of the current profile UI.

## Specific Current Defects to Address

- `ProfilePage` shortcut buttons and helper text remain too light/faint compared with milestone 24 high-contrast buyer color rules.
- `ProfileRoutePage` should require authentication before the profile client component issues private `/api/me` and related API calls.
- Buyer pages should avoid mixing visually unrelated card systems when a small class-only normalization is enough.

## Verification

- Run `bunx tsc --noEmit`.
- Run focused tests for changed buyer components where available.
- Inspect the diff and confirm there are no backend/API/schema/business-flow changes.
