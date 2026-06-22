# Task 1: Audit Existing Buyer Polish Issues

## Objective

Audit existing buyer pages for polish-only issues without proposing or implementing new features.

## Scope

Inspect existing buyer-facing files:

- `app/[locale]/(buyer)/**/page.tsx`
- `app/features/buyer/components/**`
- `app/features/cart/components/CartPage.tsx`
- `app/features/checkout/components/CheckoutPage.tsx`
- `app/features/order/components/**`
- `app/features/chat/components/**`
- `app/components/BuyerShell.tsx`
- `app/components/BuyerState.tsx`

## Deliverable

Create a concise implementation note for task 2 and task 3 that identifies:

- profile auth guard gap
- low-contrast profile shortcut/helper text
- high-impact visual inconsistency across profile/cart/checkout
- any touched tests that should be run

## Constraints

- Do not recommend new routes, APIs, or business workflows.
- Do not include admin or seller dashboard redesign.
