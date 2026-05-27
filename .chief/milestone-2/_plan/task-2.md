# task-2: Implement onboarding, profile, and multi-shop APIs

## Goal

Implement seller onboarding hardening and shop profile plus multi-shop context management in backend modules with strict ownership and auth boundaries.

## Scope

- Extend seller onboarding flows on top of existing lifecycle:
  - draft save
  - submit
  - status read behavior
  - resubmission behavior after rejection
- Implement seller-facing shop profile and settings read/update for owned shops.
- Implement owned shop listing and active shop context support for multi-shop users.
- Keep admin-only moderation/status controls separated from seller self-management.

## Affected Areas

- `server/modules/seller-onboarding/**`
- seller and security helpers for active shop resolution:
  - `server/modules/seller/**`
  - `server/modules/security/**`
- app context and dependency wiring if new services/repositories are introduced:
  - `server/context/app-context.ts`
- related tests under seller and onboarding modules

## Implementation Notes

- Use auth macros (`withAuth`, `withRole`) consistently; do not duplicate inline auth logic.
- Keep seller authorization based on owned active shops, not a platform SELLER role.
- Enforce ownership checks in service/repository boundaries.
- Keep response contracts backward compatible where endpoints already exist.
- Ensure API validation uses TypeBox and generated prismabox composition patterns.

## Verification

- Add or update focused tests for:
  - onboarding draft submit and status transitions
  - rejection and resubmission behavior
  - owner-only shop profile updates
  - cross-shop access rejection
  - multi-shop context selection
- Run:
  - `bunx tsc --noEmit`
  - focused seller-onboarding and seller/security test suites
