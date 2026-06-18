# Product Detail Cart Action Contract

## Affected Frontend

- `app/features/product/components/ProductDetailPage.tsx`
- Buyer cart query invalidation through existing `buyer-cart` query keys.

## Required Behavior

- Add-to-cart button:
  - stays disabled until a valid in-stock variant is selected
  - shows pending state without layout shift
  - invalidates/refetches buyer cart count after success
  - shows confirmation after success
  - shows readable error message after failure
- Buy-now button:
  - uses the same validation and mutation path
  - on success routes to `/cart`
  - does not trust client-side price or stock for final cart state
- Anonymous buyer:
  - is routed to login before mutation
  - current intended path should remain recoverable where existing routing supports it

## Constraints

- Do not redesign cart page or checkout.
- Do not bypass existing cart API.
- Do not duplicate backend cart response types manually beyond existing feature types.
