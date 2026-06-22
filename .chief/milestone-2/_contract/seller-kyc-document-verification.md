# Seller KYC Document Verification Contract

## Scope Contract

- Document-level KYC verification extends existing seller onboarding flow and does not replace application-level decision states.
- Verification applies to seller KYC documents linked to `SellerApplication`.
- Existing onboarding endpoints remain backward compatible; new fields and routes may be additive only.

## Data Contract

- `SellerKycDocument` must support document review state and audit metadata:
  - `reviewStatus`: `PENDING | APPROVED | REJECTED`
  - `reviewedAt`: nullable timestamp
  - `reviewedById`: nullable admin user id
  - `rejectionReason`: nullable text, required when `reviewStatus = REJECTED`
- On seller submit/resubmit, all current application documents must transition/reset to:
  - `reviewStatus = PENDING`
  - `reviewedAt = null`
  - `reviewedById = null`
  - `rejectionReason = null`
- Required document policy remains business-type aware and consistent with existing onboarding validation:
  - `INDIVIDUAL`: `ID_CARD`, `BANK_BOOK`, `TAX_DOCUMENT`
  - `COMPANY`: `BUSINESS_CERTIFICATE`, `BANK_BOOK`, `TAX_DOCUMENT`

## API Contract

- Add admin document-review endpoint:
  - `PATCH /api/admin/seller-applications/:applicationId/documents/:documentId/review`
- Route auth:
  - uses `{ withRole: 'ADMIN' }`
- Request body contract:
  - `decision`: `APPROVED | REJECTED`
  - `rejectionReason`: optional for approve, required non-empty for reject
- Response contract:
  - returns updated admin application payload including per-document review fields
- Existing admin application detail/list responses should be extended to include document review fields without breaking current consumers.

## Application Approval Gate Contract

- Existing application review endpoint remains:
  - `PATCH /api/admin/seller-applications/:applicationId/review`
- For `decision = APPROVED`, backend must enforce required-document approval gate:
  - block approval if any required document is `PENDING` or `REJECTED`
  - return deterministic error code: `SELLER_DOCUMENTS_NOT_APPROVED`
  - include unresolved required document details in error metadata
- For `decision = REJECTED`, existing rejection reason rules remain in effect.

## Authorization and Security Contract

- Document review operations are admin-only; seller/users cannot mutate document review statuses directly.
- Seller-facing responses must not expose decrypted KYC identifiers.
- Audit fields (`reviewedById`, timestamps, reason) must be persisted through trusted backend operations only.

## UI and Localization Contract

- Admin UI must support minimal document-level review actions:
  - view per-document status and metadata
  - approve/reject each document
  - capture/display rejection reason
- Seller/admin visible KYC review status messaging must support Thai and English.

## Verification Contract

- Add focused tests for per-document decision transitions and rejection reason validation.
- Add focused tests for approval-gate enforcement and `SELLER_DOCUMENTS_NOT_APPROVED` error payload.
- Add focused tests for submit/resubmit reset behavior to pending review states.
- Add focused tests for admin-only document review authorization boundaries.
- Add focused frontend tests for admin document review UI states and locale copy coverage.
- Run `bunx tsc --noEmit`.
