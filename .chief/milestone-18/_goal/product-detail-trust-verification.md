# Product Detail Trust UX Verification

## Goal

Verify the product detail trust/content UX with focused automated checks and browser evidence.

## In Scope

- Focused product detail tests for trust/content sections and responsive-safe states.
- Regression coverage for the page still rendering purchase controls after section polish.
- Typecheck and full test run.
- Browser evidence for desktop product detail.
- Browser evidence for mobile product detail.
- Browser evidence for logged-in buyer content/trust state.

## Out of Scope

- Cross-browser certification.
- Load testing.
- Payment provider or checkout validation.
- Repeating full purchase handoff browser testing unless implementation touches that flow.

## Constraints

- Save evidence or notes under `.chief/milestone-18/_report/`.
- Document any seed-data limitations instead of forcing unsafe or unrelated flows.
- Keep verification aligned with frontend-only scope.
