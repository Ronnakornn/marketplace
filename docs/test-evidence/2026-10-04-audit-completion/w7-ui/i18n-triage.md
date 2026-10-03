# Task-introduced i18n findings

Both findings in the root i18n.log were false positives. No visible English copy was added to the baseline.

- AdminSettlementRefundActions.tsx quantity label: the audit regular expression split a nested template literal and treated the programmer expression `: index + 1}` as English text. Replaced only that label expression with an array joined by a space. It still consists of the translated quantity label and the server product/variant name, or the numeric row fallback. The component's 16 tests pass.
- app/i18n/client.tsx finite-number diagnostic: `useFormatters.number` throws `RangeError("Display number must be finite")` for invalid nonfinite input while formatting a render value. This is a programmer invariant, not a toast, form-validation message, API error-state message, or JSX copy. Added one audit exception anchored to this exact file, exact message, and `throw new RangeError(` context. No general RangeError exemption, file exemption, or baseline finding was added.

Audit PASS: **2287 English keys, 2287 Thai keys, placeholder parity OK, 0 baselined findings**. Existing baseline findings/exceptions file remains unchanged. There were no remaining out-of-scope findings to absorb into the baseline. app/lib/money.ts was not a reported finding in this scoped audit and received no exception or source change.

Four isolated controls execute the actual audit script: the exact programmer invariant passes; identical text rendered in JSX fails; a different RangeError message fails; the same diagnostic in a different module fails. Results are in i18n-negative-controls.json and the rerunnable runner is i18n-negative-controls.py. Fixtures run only in verified temporary directories.

Final typecheck PASS, exit 0. Whitespace checks passed. App source is refrozen. No build, browser, database mutation, or commit was performed for this audit correction.
