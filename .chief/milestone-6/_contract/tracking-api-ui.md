# Contract: Discovery Tracking

## Events

Track these events:

- product impression
- product click
- search submitted
- filter applied
- category viewed
- banner clicked
- recommendation clicked
- recently viewed update

## Payload Rules

Payloads may include:

- user id when authenticated
- anonymous session id when available
- product id
- shop id
- category id
- query
- filters
- source section
- position
- timestamp

Rules:

- Do not store unnecessary personal data.
- Tracking calls must not block navigation or UI actions.
- Frontend should debounce or batch noisy impression events where practical.
- Backend should reuse `SearchQueryLog`, `ProductViewLog`, `ShopViewLog`, or existing models where practical.
- Add small tracking endpoints only when existing APIs cannot record the event.
