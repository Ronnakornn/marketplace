# Task 1: Localized Storefront Data Foundation

## Objective

Add seller-owned Thai and English storefront content without breaking existing
shop descriptions or policies.

## Dependencies

- None.

## Inputs

- Goals: `../_goal/storefront-truth-and-identity.md`,
  `../_goal/storefront-localization-and-seo.md`
- Contracts: `../_contract/storefront-localized-data-and-seo.md`,
  `../_contract/public-storefront-api.md`

## Ownership

- `prisma/schema.prisma` and the migration created for this task
- Generated Prisma output, regenerated only through the repository command
- `server/modules/seller-shop/**`
- Seller shop-profile/settings forms, queries, mutations, and translations
  under `app/features/seller/**`
- Focused seller-shop and seller settings tests

## Implementation Order

1. Add nullable `descriptionTh` and `descriptionEn` fields to `Shop`.
2. Add nullable `shippingPolicyTh`, `shippingPolicyEn`, `returnPolicyTh`, and
   `returnPolicyEn` fields to `ShopSetting`.
3. Create a non-destructive Prisma migration and run client/schema generation.
   Do not edit generated files manually.
4. Extend seller-shop repository selects and update inputs. Keep database
   access in the repository.
5. Extend service normalization and ownership checks. Define one reusable
   locale fallback helper with these exact orders:
   - Thai: Thai field, base field, English field.
   - English: English field, base field, Thai field.
6. Extend the existing seller-authenticated profile/settings validation and
   routes additively using generated/Prismabox schemas plus TypeBox
   composition. Do not duplicate Prisma entity schemas.
7. Add optional Thai and English fields to the existing seller forms. Preserve
   base-field editing and invalidate the current seller shop/settings queries
   after a successful mutation.
8. Add focused repository, service, route, form, ownership, empty-value, and
   fallback-order tests.

## Constraints

- Existing data must remain valid; all new columns are nullable.
- Sellers may update only their own shop and settings.
- Browser requests use same-origin `/api/*`; server state uses TanStack Query
  and inferred API types.
- Empty strings must be normalized consistently before persistence so they do
  not unexpectedly shadow a usable fallback.
- Do not expose any new public fields in this task.

## Acceptance Criteria

- Existing rows migrate without a backfill requirement.
- A seller can save and reload all localized description and policy fields.
- Unauthorized cross-shop updates are rejected.
- Both locale fallback orders are covered by deterministic tests.
- Existing base description and policy behavior remains compatible.

## Verification

- `bun run db:generate`
- `bun run test -- server/modules/seller-shop`
- Run the focused seller shop/settings component tests added by this task.
- `bunx tsc --noEmit`
- `bun run audit:i18n`

