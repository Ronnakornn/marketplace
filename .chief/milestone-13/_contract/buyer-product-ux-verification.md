# Buyer Product UX Verification Contract

## Scope

Verify buyer product UX/UI changes with automated tests and browser checks.

## Required Automated Checks

Run:

```bash
bunx tsc --noEmit
bun run test
```

Targeted tests should run first during implementation for:

- product detail component behavior
- product card behavior
- product query normalizers
- catalog/related/recently-viewed backend routes if changed

## Browser Verification

After implementation, run a local app target and verify:

- Product detail desktop viewport.
- Product detail mobile viewport.
- Listing/search card grid desktop viewport.
- Listing/search card grid mobile viewport.

Verification should check:

- no blank product media areas when fallback image is expected
- no text overlap
- sticky purchase bar does not cover critical content unexpectedly
- controls remain reachable with keyboard/focus states
- related/recently viewed sections do not cause layout breakage

## Accessibility Minimums

- Icon buttons need accessible names.
- Variant and gallery controls need visible focus states.
- Disabled states must be clear.
- Color swatches cannot be the only indicator of option identity.

## Report

The milestone report must include:

- test commands and results
- browser targets/viewports checked
- screenshots or screenshot paths when captured
- known UX gaps left for later
