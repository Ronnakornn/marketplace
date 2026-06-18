# Task 2: Discovery Tracking and Recently Viewed

## Goal

Record lightweight discovery events without blocking buyer navigation or introducing an analytics platform.

## Affected Areas

- `server/modules/search/**`
- `server/modules/catalog/**`
- analytics/event endpoint module if existing
- `app/features/product/**`
- `app/features/marketplace/**`
- frontend hooks/utilities for tracking
- tests

## Required Work

1. Implement or reuse tracking endpoints for:
   - product impression
   - product click
   - search submitted
   - filter applied
   - category viewed
   - banner clicked
   - recommendation clicked
   - recently viewed update
2. Reuse `SearchQueryLog`, `ProductViewLog`, `ShopViewLog`, or existing models where practical.
3. Add frontend tracking utility/hook that:
   - does not block navigation
   - debounces or batches noisy impressions where practical
   - supports anonymous session id where available
   - supports authenticated user context where available
4. Add recently viewed product behavior using existing data or a small endpoint/local fallback.

## Out of Scope

- Analytics dashboard.
- Attribution.
- A/B testing.

## Acceptance Criteria

- Tracking payload validation rejects malformed events.
- Product clicks and impressions can be emitted from product cards.
- Search and filter events can be emitted from listing pages.
- Recently viewed section can render for users with recent product views.
- No unnecessary personal data is stored.

## Verification

```bash
bunx tsc --noEmit
bun run test
```

Focused tests:

- tracking payload validation
- product view/click recording
- search query logging
- recently viewed data fallback
