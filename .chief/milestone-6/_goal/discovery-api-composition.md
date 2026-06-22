# Goal: Discovery API Composition

## Outcome

Discovery UI can fetch homepage, search, listing, merchandising, and tracking data through clear API contracts.

## Scope

- Compose homepage sections from existing domain modules when possible.
- Use catalog APIs for product lists and details.
- Use search APIs for keyword results where available.
- Use recommendation APIs for recommendation rails where available.
- Use promotion and flash sale data for merchandising badges where available.
- Add thin composition endpoints only where frontend orchestration would become brittle.

## Success Criteria

- API composition stays in backend modules and `server/index.ts` remains the composition root.
- Frontend uses same-origin `/api/*` requests and Eden Treaty types.
- Discovery APIs paginate large product lists.
- Optional sections can be omitted without causing frontend errors.
