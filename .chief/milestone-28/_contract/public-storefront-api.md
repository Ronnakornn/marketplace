# Contract: Public Storefront Profile API

## Endpoint

Add a public read endpoint:

```text
GET /api/shops/:shopId/storefront?locale=th|en
```

- `shopId` accepts an active shop UUID or canonical slug.
- Inactive, deleted, suspended, pending, or unknown shops return `404` without
  revealing private status details.
- Authentication is optional. When a valid session exists, the response may
  include viewer-relative booleans but never the owner's identity.

## Response

```ts
interface PublicStorefrontProfile {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  ratingAverage: number
  ratingCount: number
  followerCount: number
  productCount: number
  chatEnabled: boolean
  shippingPolicy: string | null
  returnPolicy: string | null
  updatedAt: string
  viewer: {
    isOwner: boolean
  }
}
```

## Data Rules

- Counts and rating values come from persisted shop aggregates and published
  review truth, not the currently loaded catalog page.
- `productCount` represents active, non-deleted, publicly visible products.
- `chatEnabled` is true only for an active shop whose settings enable chat.
- Optional media URLs are returned as stored public asset references and are
  resolved through the existing asset URL helper in the frontend.
- Localized text follows the localization fallback contract in this milestone.
- The endpoint must not expose owner ID, email, phone, staff, addresses,
  moderation reasons, wallet data, or operational settings.

## Architecture

- Public storefront profile reads belong to the seller-shop domain.
- Product listing remains in catalog endpoints, reviews remain in shop-review,
  follow state remains in user, and chat room creation remains in chat.
- Frontend response types are inferred through Eden Treaty; no duplicate manual
  API response interface is maintained in application code.

## Compatibility

- Existing seller shop-profile and settings endpoints remain unchanged except
  for additive localized fields defined by this milestone.
- Existing SEO helpers may consume the public storefront lookup but must not
  become a second source of storefront business rules.
