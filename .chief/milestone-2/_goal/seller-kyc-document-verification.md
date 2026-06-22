# Seller KYC Document Verification Goal

## Objective

Add document-level KYC verification to seller onboarding so admin decisions are explicit per required document and application approval is blocked until required documents are approved.

## Scope

- Add document-level review lifecycle for seller KYC documents:
  - default `PENDING`
  - admin `APPROVED` or `REJECTED` per document with reason for rejection
- Keep seller application-level decision flow (`APPROVED` or `REJECTED`) and enforce dependency:
  - required documents must be approved before application approval is allowed
- On seller submit or resubmit, reset all document review statuses to pending for fresh review.
- Add minimal admin review UI support for document-level actions:
  - show per-document status
  - approve/reject each document
  - show and edit rejection reason where applicable
- Keep Thai and English user-facing copy for new admin and seller-facing KYC status messages.

## Success Criteria

- Admin can review and decide each required KYC document independently.
- Application approval is deterministically blocked when required KYC documents are pending or rejected.
- Rejected applications can be corrected and resubmitted, with document checks restarting in pending state.
- Admin and seller UIs show clear document-level review status and actionable rejection feedback.
- Existing onboarding lifecycle and route compatibility are preserved.

## Out of Scope

- External KYC provider integration or OCR/face-match automation.
- Multi-stage compliance workflows beyond pending/approved/rejected per document.
- Legal/compliance policy engine redesign.

## Verification Goal

- Add focused tests for per-document review transitions and rejection reason requirements.
- Add focused tests that block application approval until required documents are approved.
- Add focused tests for submit/resubmit reset behavior to pending document states.
- Add focused tests for admin UI document review states and localization coverage.
- Run `bunx tsc --noEmit`.
