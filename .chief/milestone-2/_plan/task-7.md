# task-7: Deliver admin UI and i18n for document-level KYC review

## Goal

Deliver minimal production-usable admin UI for per-document KYC approval/rejection and rejection-reason workflows with Thai and English localization.

## Scope

- Extend admin seller application queue/detail surfaces to show document-level review metadata.
- Add per-document actions:
  - approve document
  - reject document with required reason
- Surface approval-gate failure feedback when application approve is blocked by unresolved required documents.
- Add locale messages for new admin and seller-visible KYC review states in `en` and `th`.

## Relation to Existing Specs

- Extends [task-5](.chief/milestone-2/_plan/task-5.md):
  - task-5 covers broad seller-facing UI and i18n work.
  - this task adds explicit admin-side document review UX and messaging bound to the new backend KYC verification contracts.
- Depends on [task-6](.chief/milestone-2/_plan/task-6.md) API availability.

## Affected Areas

- Admin feature UI/hooks:
  - `app/features/admin/components/AdminSellerApplicationsTable.tsx`
  - `app/features/admin/hooks/useAdminOperations.ts`
  - supporting admin UI components under `app/features/admin/components/**`
- Optional seller status visibility updates if needed:
  - `app/features/seller/components/SellerOnboardingPages.tsx`
- Localization:
  - `messages/en.json`
  - `messages/th.json`
- Frontend tests:
  - `app/features/admin/components/AdminSellerApplicationsTable.test.tsx`
  - other focused admin/seller onboarding UI tests as needed

## Implementation Notes

- Keep existing admin flow stable; add document controls as additive UI.
- All new network calls must use existing typed Eden hooks/patterns.
- Ensure deterministic UI states:
  - loading
  - success
  - validation error
  - API failure and retry
- Reject action must prevent submit without reason.
- Show unresolved required document details from `SELLER_DOCUMENTS_NOT_APPROVED` in actionable form.
- Maintain accessibility basics for dialog/forms (labels, focus flow, visible error text).

## Verification

- Add/update focused frontend tests for:
  - rendering document status per application
  - approve/reject action wiring and reason validation
  - blocked application approval error display
  - i18n message coverage for new text keys
- Run:
  - `bunx tsc --noEmit`
  - focused admin and seller onboarding UI tests
