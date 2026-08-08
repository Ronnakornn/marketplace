# Contract: Storefront Actions, Reviews, and Policies

## Viewer Actions

- Anonymous visitors selecting follow or chat are sent through the localized
  login route and return to the storefront flow where supported.
- Authenticated buyers can follow/unfollow through existing user endpoints.
- Chat is offered only when the public storefront profile reports
  `chatEnabled=true`.
- Chat invokes existing `createChatRoom({ shopId })`; success navigates directly
  to the localized `/chat/:roomId` route whether the room was new or existing.
- Chat pending and failure states are visible and do not discard the page.
- The backend remains authoritative for self-chat and role restrictions.

## Owner Mode

- `viewer.isOwner=true` hides buyer-only follow and chat actions.
- The owner receives a localized action linking to the seller dashboard with
  the owned shop selected.
- Owner mode is derived server-side; public responses do not expose owner ID.

## Review Summary and Feed

- The header rating summary links to the reviews section.
- Show the latest three published reviews with buyer display name, rating,
  comment when present, and published date.
- Pending, rejected, and hidden reviews never appear publicly or affect the
  public summary.
- Preserve the existing legacy array response for
  `GET /api/shops/:shopId/reviews`.
- Add a backward-compatible paginated read endpoint:

```text
GET /api/shops/:shopId/reviews/feed?page=1&limit=10
```

```ts
interface PublicShopReviewFeed {
  items: PublicShopReview[]
  meta: {
    page: number
    pageSize: number
    totalCount: number
    hasNextPage: boolean
  }
}
```

- “View all” expands or navigates to a paginated published-review surface; it
  must not imply completeness while only increasing a bounded legacy limit.

## Policies

- Render non-empty localized shop description, shipping policy, and return
  policy as plain text.
- Policies appear after catalog and latest reviews in accessible accordion
  sections.
- Empty policies are omitted rather than rendered as placeholder claims.
- Seller-authored text is never interpreted as HTML.
