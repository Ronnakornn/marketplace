# Task 5: Milestone Verification and Evidence

## Objective

Prove the complete storefront milestone across data, authorization, behavior,
localization, responsive UI, analytics, and regression risk.

## Dependencies

- Tasks 1 through 4 must be complete.

## Inputs

- Every goal and contract in `.chief/milestone-28/`
- Tasks 1 through 4 and their focused test suites

## Ownership

- Missing or corrected tests directly related to milestone 28
- Playwright storefront scenarios under the repository's existing E2E layout
- `.chief/milestone-28/_report/verification.md`
- Milestone-owned implementation files only when verification exposes a defect

## Verification Matrix

1. Data and API:
   - migration compatibility and generated artifacts;
   - UUID/slug storefront resolution and strict public allowlist;
   - seller ownership and inactive-shop protection;
   - localized fallback and review publication filtering;
   - catalog search/facet/sort/pagination correctness;
   - tracking bounds, deduplication, and non-blocking failure.
2. UI behavior:
   - Thai and English;
   - desktop and mobile;
   - cover/logo, cover-only, logo-only, and no-media;
   - anonymous buyer, authenticated buyer, and owner;
   - populated, empty, and out-of-stock catalog;
   - load-more success, terminal page, and retryable next-page failure;
   - published-review history and missing-policy states;
   - follow/login return and direct chat-room navigation.
3. Shared regressions:
   - homepage buyer header/mobile navigation;
   - other `ProductCard` call sites;
   - AppChrome on non-shop routes;
   - legacy review endpoint consumers;
   - seller profile/settings editing.

## Implementation Notes

- Add deterministic unit/integration coverage before browser scenarios.
- Use seeded fixtures or API setup that creates exact states; do not make E2E
  assertions depend on mutable shared demo data.
- Capture concise desktop/mobile screenshots or traces for the key Thai and
  English scenarios and list their paths in the verification report.
- Record every command, pass/fail result, repaired regression, and any accepted
  residual risk in the report.
- Fix only milestone-related fallout. Report unrelated pre-existing failures
  separately and do not rewrite user-owned changes.

## Acceptance Criteria

- Every milestone goal and contract clause maps to a passing automated test or
  explicit browser evidence in the verification report.
- No seller isolation, public-data leakage, localization, shared-navigation, or
  shared-card regression remains.
- Typecheck, full tests, i18n audit, production build, and storefront E2E pass,
  or a pre-existing unrelated failure is reproduced and documented precisely.
- The TODO may be marked complete only after the evidence report exists.

## Verification Commands

- `bun run db:generate`
- `bunx tsc --noEmit`
- `bun run test`
- `bun run audit:i18n`
- `bun run build`
- `bun run test:e2e`

