# task-5: Deliver seller UI, i18n, and verification

## Goal

Deliver seller-facing UI integration for onboarding, profile, multi-shop context, dashboard insights, shop reviews, and staff foundation with Thai and English localization and focused verification.

## Scope

- Implement or extend seller pages for:
  - onboarding and status UX
  - shop profile management
  - multi-shop selection behavior
  - dashboard insight display
  - shop review visibility and status communication
  - staff foundation management surfaces
- Integrate backend APIs with Eden and TanStack Query patterns.
- Ensure all new user-facing strings are available in `th` and `en` locale messages.
- Add focused UI and integration tests for changed flows.

## Affected Areas

- `app/[locale]/seller/**`
- `features/seller/**`
- shared UI components if needed under `components/**`
- `messages/th.json`
- `messages/en.json`
- frontend hooks for seller and review data fetching
- frontend tests for seller feature flows

## Implementation Notes

- Preserve existing visual language and navigation patterns.
- Keep query keys shop-scoped for multi-shop flows.
- Show explicit loading, empty, error, and success states on all new seller surfaces.
- Use inferred backend types through Eden where available; avoid manual DTO duplication.
- Keep accessibility basics: labels, focusable controls, visible validation/error text.

## Verification

- Add or update focused tests for:
  - onboarding and status UI states
  - shop profile edit and retry paths
  - multi-shop selector behavior
  - dashboard insight rendering states
  - shop review and moderation-aware display states
  - staff invitation and status update UX states
  - locale message coverage for new UI text
- Run:
  - `bunx tsc --noEmit`
  - focused frontend seller and review tests
  - `bun run test` if shared behavior changes require wider regression safety
