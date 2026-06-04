# Goal: Discovery Tracking

## Outcome

Discovery behavior emits lightweight events that can support search, recommendations, and future analytics work.

## Scope

- Product impressions.
- Product clicks.
- Search submitted.
- Filter applied.
- Category viewed.
- Banner clicked.
- Recommendation clicked.
- Recently viewed update.
- Reuse `SearchQueryLog`, `ProductViewLog`, `ShopViewLog`, and existing models when possible.
- Add only small event endpoints that are clearly missing.
- Do not implement a full analytics dashboard, attribution system, or A/B testing platform.

## Success Criteria

- Tracking does not block buyer navigation.
- Event payloads avoid storing unnecessary personal data.
- Events can be emitted for anonymous sessions and authenticated users where supported.
- Duplicate/noisy events are reasonably controlled on frontend surfaces.
