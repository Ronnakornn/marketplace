# task-8: Add focused regression tests for KYC verification safety

## Goal

Add focused regression coverage to prevent future breakage in document-level KYC verification, approval-gate enforcement, and authorization boundaries.

## Scope

- Add backend regression tests for:
  - submit/resubmit reset of document review states to pending
  - application approval blocking with unresolved required documents
  - deterministic `SELLER_DOCUMENTS_NOT_APPROVED` error code and metadata shape
  - admin-only access to document review mutation routes
- Add frontend regression tests for:
  - blocked approval UX using backend error metadata
  - per-document action state consistency after mutation success/failure
- Keep test suite bounded and deterministic.

## Relation to Existing Specs

- Hardens behavior introduced in [task-6](.chief/milestone-2/_plan/task-6.md) and [task-7](.chief/milestone-2/_plan/task-7.md).
- Complements earlier onboarding behavior checks from [task-2](.chief/milestone-2/_plan/task-2.md) with new KYC verification invariants.

## Affected Areas

- Backend tests around seller onboarding:
  - `server/modules/seller-onboarding/seller-onboarding.service.test.ts`
  - route/contract tests for admin authorization and response error shape
- Frontend tests:
  - `app/features/admin/components/AdminSellerApplicationsTable.test.tsx`
  - any supporting hook/component tests for document review actions

## Implementation Notes

- Prefer focused tests over broad end-to-end rewrites.
- Keep fixtures explicit for business type differences (INDIVIDUAL vs COMPANY required docs).
- Assert both behavior and error contract payload, not only status code.
- Ensure tests protect against approving applications when required docs are pending/rejected.

## Verification

- Run:
  - `bunx tsc --noEmit`
  - focused backend seller-onboarding test suite
  - focused frontend admin/seller onboarding test suite
- Run broader `bun run test` if shared helpers/contracts changed beyond focused scope.
