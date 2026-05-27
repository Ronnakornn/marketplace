# Shop Registration and Onboarding Goal

## Objective

Deliver a complete seller shop registration experience on top of the existing application flow so users can open shops with clear status and safe validation.

## Scope

- Reuse and harden existing seller application lifecycle:
  - draft save
  - submit
  - admin review
  - approved/rejected status handling
- Align onboarding lifecycle with document-level KYC verification outcomes:
  - seller submit and resubmit reset document verification to pending for re-review
  - application approval remains blocked until required KYC documents are approved
- Improve onboarding UX across:
  - `/seller/register`
  - `/seller/status`
- Enforce role-journey route behavior for buyer-to-seller conversion:
  - buyer users may access seller onboarding routes (`/seller/register`, `/seller/status`) based on application status
  - submitted or approved-without-active-shop users are constrained to `/seller/status`
  - rejected/cancelled users can re-enter `/seller/register` directly for correction and resubmission
- Keep onboarding tied to authenticated user identity and owned seller profile.
- Keep registration compatible with Thailand-focused KYC fields already present in schema and service flow.
- Ensure Thai and English user-facing strings are supported for the onboarding surfaces in this milestone.

## Success Criteria

- A buyer account can complete registration draft and submit without manual API-only fallback.
- Required registration fields and document readiness are validated with clear error feedback.
- Resubmitted applications require fresh admin document verification before approval.
- Status transitions are visible and deterministic from onboarding routes.
- Route outcomes are deterministic across onboarding statuses and reflect a Shopee-like staged seller activation flow.
- Approved applications lead to operational seller access only when shop is active.
- Rejected applications can be corrected and resubmitted through the same flow.
- Existing onboarding API behavior remains backward compatible for current consumers.

## Out of Scope

- Replacing the existing registration lifecycle with a brand-new state machine.
- Building external third-party KYC providers in this milestone.
- Redesigning unrelated seller operations pages.

## Verification Goal

- Add focused tests for draft/submit/status transition behavior and route access outcomes.
- Add focused tests for validation and required-document enforcement.
- Run `bunx tsc --noEmit`.
