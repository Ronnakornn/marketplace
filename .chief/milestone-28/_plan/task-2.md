# Task 2: Public Storefront Identity and SEO

## Objective

Expose one safe, localized public storefront read model and use it to render a
truthful shop identity surface for buyers and owners.

## Dependencies

- Task 1 must be complete.

## Inputs

- Goals: `../_goal/storefront-truth-and-identity.md`,
  `../_goal/storefront-localization-and-seo.md`
- Contracts: `../_contract/public-storefront-api.md`,
  `../_contract/storefront-localized-data-and-seo.md`

## Ownership

- Public storefront repository/service/validation/routes in
  `server/modules/seller-shop/**`
- `app/[locale]/(public)/shops/[shopId]/page.tsx`
- Storefront identity components under `app/features/storefront/**`
- `app/lib/seo.ts` only where shared SEO behavior must be extended
- Focused public storefront API, component, and metadata tests

## Implementation Order

1. Add a repository query that accepts a shop UUID or slug, resolves only an
   active public shop, and explicitly selects public fields.
2. Add a storefront service read model that applies the Task 1 locale fallback,
   returns real aggregate metrics, exposes `chatEnabled`, and computes
   `viewer.isOwner` from optional authenticated context.
3. Add `GET /api/shops/:shopId/storefront?locale=th|en` with strict parameter,
   query, response, and error schemas. Keep optional authentication optional;
   anonymous buyers must be able to read it.
4. Render the page from the shared read model. Do not add direct Prisma or
   business logic to the route component.
5. Implement adaptive media states:
   - cover and logo: cover hero with overlaid logo;
   - cover only: cover hero with a stable identity fallback;
   - logo only or neither: compact identity header without a fake cover.
6. Render real rating, review, follower, and product counts. Render owner mode
   with a localized manage-shop action; buyer follow/chat behavior is completed
   in Task 4.
7. Generate localized title/description metadata, canonical URL using the
   resolved slug, and social image fallback in this order: cover, logo, site
   default. Bound metadata lengths and preserve existing meta overrides.
8. Add security, inactive-shop, UUID/slug, locale, owner/anonymous, media-state,
   and metadata tests.

## Constraints

- The public response must never contain owner email, phone, internal IDs not
  required by the contract, private settings, or moderation data.
- Use one service/read-model source for route rendering and SEO; do not create
  competing storefront projections.
- Keep current `/shops/:shopId` links working while canonicalizing to the slug.
- Metrics must come from persisted/authoritative data, never placeholders.

## Acceptance Criteria

- UUID and slug requests resolve to the same active shop payload.
- Inactive or missing shops return the repository-standard not-found response.
- Thai and English pages show the specified localized fallback content.
- Owner and buyer states are correct without leaking private shop data.
- All four media combinations render without broken images or layout gaps.
- Canonical and social metadata use the resolved shop and locale.

## Verification

- `bun run test -- server/modules/seller-shop`
- Run focused storefront page/component and metadata tests added by this task.
- `bunx tsc --noEmit`
- `bun run audit:i18n`

