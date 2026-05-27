# task-6: Implement backend document-level KYC verification and approval gate

## Goal

Implement backend support for per-document KYC review decisions and enforce required-document approval gate before application-level approval.

## Scope

- Extend seller KYC document data model and repository contracts with document review metadata.
- Implement admin API for per-document review action:
  - `PATCH /api/admin/seller-applications/:applicationId/documents/:documentId/review`
- Enforce approval gate in existing application review path:
  - block `decision=APPROVED` when required documents are not all approved
  - return deterministic error `SELLER_DOCUMENTS_NOT_APPROVED` with unresolved required documents
- Reset document review metadata to pending state on submit and resubmit.

## Relation to Existing Specs

- Extends [task-2](.chief/milestone-2/_plan/task-2.md):
  - task-2 delivered onboarding lifecycle and profile/multi-shop API behavior.
  - this task adds document-level admin verification and approval-gate rules inside that lifecycle.
- Does not replace [task-2](.chief/milestone-2/_plan/task-2.md); it narrows and hardens KYC review behavior.

## Affected Areas

- Prisma schema and generated outputs:
  - `prisma/schema.prisma`
  - `generated/client/**` (regenerated)
  - `generated/prismabox/**` (regenerated)
- Seller onboarding backend module:
  - `server/modules/seller-onboarding/seller-onboarding.repository.ts`
  - `server/modules/seller-onboarding/seller-onboarding.service.ts`
  - `server/modules/seller-onboarding/seller-onboarding.routes.ts`
  - `server/modules/seller-onboarding/seller-onboarding.errors.ts`
- API contracts/docs if endpoint set changes:
  - `docs/06-backend/api-contracts.md`

## Implementation Notes

- Keep existing application-level decision endpoint backward compatible.
- New document review endpoint must be admin-only via auth macro.
- Reject document decision must require non-empty rejection reason.
- Approval gate must compute required document set by current business type:
  - INDIVIDUAL: ID_CARD, BANK_BOOK, TAX_DOCUMENT
  - COMPANY: BUSINESS_CERTIFICATE, BANK_BOOK, TAX_DOCUMENT
- Submit/resubmit reset must clear document review decision and audit metadata transactionally with application submit.
- Keep sensitive KYC values masked/encrypted; never expose decrypted values in responses.

## Verification

- Add/update focused backend tests for:
  - document review decision transitions and validation
  - admin-only authorization on document review endpoint
  - approval gate blocking and `SELLER_DOCUMENTS_NOT_APPROVED` metadata payload
  - submit/resubmit reset to pending behavior
- Run:
  - `bunx prisma format`
  - `bunx prisma validate`
  - `bun run db:generate`
  - `bunx tsc --noEmit`
  - focused seller-onboarding test suite
