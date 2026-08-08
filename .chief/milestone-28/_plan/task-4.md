# Task 4: Reviews, Policies, Buyer Actions, and Tracking

## Objective

Complete the storefront decision and action path with published reviews,
localized policies, correct follow/chat behavior, and bounded funnel events.

## Dependencies

- Tasks 2 and 3 must be complete.

## Inputs

- Goals: `../_goal/storefront-catalog-and-actions.md`,
  `../_goal/storefront-navigation-analytics-and-quality.md`
- Contracts: `../_contract/storefront-actions-reviews-and-policies.md`,
  `../_contract/storefront-navigation-tracking-verification.md`

## Ownership

- Paginated public review work under `server/modules/shop-review/**`
- Shop-event persistence and API work under the existing tracking/analytics
  module and `prisma/schema.prisma` if the explicit event discriminator below
  requires it
- Storefront actions, reviews, policy, and tracking clients/components under
  `app/features/storefront/**`
- Existing chat and follow client integration points, changed only as needed
- Focused review, action, tracking, authorization, and component tests

## Implementation Order

1. Preserve the existing array-based shop review endpoint unchanged. Add
   `GET /api/shops/:shopId/reviews/feed?page=1&limit=10` for published reviews
   with `{ items, meta }`, stable newest-first ordering, bounded page size, and
   no unpublished/private review data.
2. Render the latest three published reviews plus a localized link/anchor to
   the full paginated review history. Add complete loading, empty, error, and
   pagination states.
3. Render shipping and return policies as plain text in accessible accordions,
   using the localized values already returned by the storefront read model.
4. Implement buyer actions:
   - anonymous follow/chat redirects to localized login with a safe return URL;
   - follow is idempotent and refreshes the authoritative follower state/count;
   - chat creates or reuses a room and navigates directly to localized
     `/chat/:roomId`;
   - owner mode shows manage shop and does not offer self follow/chat.
5. Persist shop funnel events with an explicit bounded discriminator. Prefer a
   Prisma `ShopViewEventType` enum and a non-null `eventType` on `ShopViewLog`
   (`VIEW`, `FOLLOW`, `CHAT_OPEN`) with a safe default/backfill for existing
   rows. Add the migration and regenerate instead of editing generated output.
6. Record `shop_viewed`, successful `shop_followed`, and successful
   `shop_chat_opened`; attach only bounded non-sensitive metadata. Continue to
   use the existing product impression/click and search/filter event paths with
   a storefront source marker.
7. Fire analytics after the user-visible action succeeds and make analytics
   failure non-blocking. Deduplicate shop views using the existing analytics
   session/window convention rather than inventing a browser-global flag.
8. Add authorization, publication filtering, pagination, idempotency,
   self-action, login return, room reuse/navigation, event schema, event
   deduplication, and non-blocking failure tests.

## Constraints

- Existing review consumers must not change response shape.
- Chat must retain the backend prohibition on chatting with one's own shop.
- Tracking must not contain email, phone, address, message text, or free-form
  user content.
- A tracking outage must never break catalog browsing, follow, or chat.
- All visible labels, status text, and empty/error messages require Thai and
  English translations.

## Acceptance Criteria

- Only published reviews appear publicly; the latest section shows at most 3.
- Policies follow the locale fallback and remain readable when one is absent.
- Buyer, anonymous, and owner actions follow the contract exactly.
- Chat lands on the created/reused room, not a generic chat index.
- Shop, product, filter, follow, and chat funnel signals are recorded without
  private data or duplicate shop-view inflation.

## Verification

- `bun run db:generate` when the event discriminator changes Prisma
- `bun run test -- server/modules/shop-review`
- Run focused tracking, chat/follow integration, and storefront component tests.
- `bunx tsc --noEmit`
- `bun run audit:i18n`

