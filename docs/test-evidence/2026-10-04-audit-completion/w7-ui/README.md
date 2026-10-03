# W7 UI proof

App source frozen after this run. Root owns the coherent commit and browser verification.

- All-app Vitest: **420 passed, 0 failed, 62 files**. This includes 29 new component/API regressions over the prior 391-test suite. `app-tests.json` is the exact machine report.
- Earlier focused gate: **53 passed, 0 failed**, covering checkout acceptance/tax/stacked coupons, admin quantity/tax controls, operator tax policy, buyer return capacity, receipt metadata, and original order money parsing. The additional duplicate-slot coupon regression was included in the final all-app run.
- Final typecheck: **PASS, exit 0**, empty diagnostics in `typecheck.log`. The earlier temporary root E2E unused-import error is retained in `typecheck-before-e2e.log` for chronology.
- `git diff --check -- app messages e2e` passed. Git emitted its normal LF-to-CRLF checkout notice for finance-lifecycle.spec.ts.
- No browser, full build, database operation, commit, or push was performed by this UI unit.

## Behavior covered

Checkout submits both `acceptedQuoteFingerprint` and `acceptedTaxPolicyRevision` from the displayed quote. Missing evidence blocks submit; a server rejection refreshes the quote and requires another user click. Shop and platform coupon slots use separate query-key/input fields, retain legacy voucher support, and map duplicate codes by the API's declared shop-then-platform outcome order.

Inclusive tax is disclosed without another addition to grandTotal. Exclusive tax is shown separately. Original order receipts retain included, added, and reported tax amounts. No legal rate is assumed; admin/settings starts from the server policy, accepts exact percentages to four decimal places, explicitly exposes taxable funding/shipping choices, and states the settlement activation gate.

Buyer quantities use server `remainingReturnQuantity` and `hasActiveReturn`; missing rights fail closed. Admin quantities use server `remainingQuantity` and display original NET/TAX components. Literal allocator outcomes 31+2, 31+2, and 32+3 are checked in the UI fixtures, corresponding to cash rights 33/33/35. These tests check representation and admission controls; actual PG lifecycle and browser UI/API/DB parity remain root-owned proof.

Model the Domain shaped the legacy-or-stack coupon selection union. Type System Discipline shaped Eden-derived request, policy, order-rights, and refund-allocation types. No backend response was weakened with an unsafe cast. App code formats canonical minor-unit strings with the shared exact money helpers; only nonmonetary quantities and percentage rates use bounded numeric form conversion.

The accepted comment-review deletion removed only the new lifetime-ledger narration from e2e/finance-lifecycle.spec.ts; the remaining E2E source was not edited by this W7 UI unit.


## Production directive correction

Root's subsequent production build found an embedded BOM before the `use client` directive in MarketplaceHome.tsx, with the money import preceding the directive. Corrected only that file by putting the directive first and removing the BOM. The TypeScript AST census checked **345 app source files, 122 client directives, 0 misplaced directives, 0 literal BOMs**. `client-directives.json` records the result. This metadata correction occurred after the 420-test run; root owns the actual Turbopack rebuild and browser proof. Final typecheck above ran after the correction.
