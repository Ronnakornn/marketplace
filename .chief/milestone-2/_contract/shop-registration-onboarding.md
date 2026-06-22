# Shop Registration and Onboarding Contract

## Lifecycle Contract

- Registration must extend the existing seller application lifecycle, not replace it:
  - DRAFT
  - SUBMITTED
  - APPROVED
  - REJECTED
  - CANCELLED
- Existing core endpoints remain contract-stable:
  - `GET /api/seller/application`
  - `POST /api/seller/application/draft`
  - `POST /api/seller/application/submit`
  - `GET /api/admin/seller-applications`
  - `GET /api/admin/seller-applications/:applicationId`
  - `PATCH /api/admin/seller-applications/:applicationId/review`
- Existing response shapes may be extended with optional fields but must stay backward compatible for current frontend consumers.

## Validation Contract

- Validation remains backend-authoritative; frontend validation is convenience only.
- Submit path must enforce required onboarding/KYC fields and required uploaded document completeness.
- Submit/resubmit path must reset document-level verification statuses to `PENDING` for fresh admin review.
- Draft path may accept partial payloads and preserve previously saved values where input is omitted.
- Validation schemas must use existing TypeBox/Prismabox composition patterns.

## Security and Auth Contract

- Seller onboarding routes use `{ withAuth: true }`.
- Admin review routes use `{ withRole: 'ADMIN' }`.
- Do not introduce a platform `SELLER` role dependency.
- Seller access remains identity-based through authenticated user plus seller profile/shop ownership status.
- Sensitive fields remain encrypted/masked per existing onboarding and profile rules.
- Route gating outcomes for onboarding pages must be status-deterministic:
  - `DRAFT`/no application -> `/seller/register`
  - `SUBMITTED` -> `/seller/status`
  - `APPROVED` without active shop -> `/seller/status`
  - `REJECTED`/`CANCELLED` -> direct `/seller/register` allowed for correction and resubmit.

## Shop Activation Contract

- Approved application must map consistently to seller operational access only when an owned shop is active.
- Application-level approval must be blocked until all required KYC documents are document-level `APPROVED`.
- Approval-blocking responses must provide deterministic error metadata for unresolved required documents.
- Rejected application must preserve rejection reason and allow corrective resubmission.
- Onboarding/status route gating must stay deterministic and locale-safe.

## UX and Localization Contract

- `/seller/register` and `/seller/status` states must include deterministic loading, error, empty, and success handling.
- User-facing messages for onboarding and status outcomes must support Thai and English in this milestone.
- Behavioral flow may reference Shopee-style staged seller activation patterns, but implementation and copy remain original and project-specific.

## Verification Contract

- Add focused tests for draft save, submit validation, admin review outcomes, and resubmission flow.
- Add focused tests for resubmit behavior that resets document verification to pending.
- Add focused tests that reject application approval when required documents are pending/rejected.
- Add focused tests for route gating from onboarding states to operational seller access.
- Run `bunx tsc --noEmit`.
