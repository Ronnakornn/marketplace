# Product Detail Trust Verification Contract

## Purpose

Milestone 18 must prove trust/content UX changes without expanding into checkout or payment validation.

## Automated Verification

- Run focused product detail tests covering trust/content section rendering.
- Cover empty and populated states where fixtures already support them.
- Cover page-level regression that purchase controls still render after section polish.
- Run `bunx tsc --noEmit`.
- Run `bun run test`.

## Browser Evidence

- Capture desktop product detail trust/content state.
- Capture mobile product detail trust/content state.
- Capture logged-in buyer content/trust state.
- Save screenshots or notes under `.chief/milestone-18/_report/`.

## Acceptance Checks

- No text overlap or clipped controls in trust/content sections.
- Lower product detail sections remain visible above the sticky buy bar with enough bottom spacing.
- Reviews/Q&A/discovery states are readable on mobile and desktop.
- Purchase decision and sticky buy bar behavior remains functionally unchanged unless tests intentionally update expectations.

## Boundaries

- Cross-browser certification is not required.
- Purchase handoff browser regression is not required unless implementation touches that flow.
- Document seed-data limitations rather than forcing unrelated state changes.
