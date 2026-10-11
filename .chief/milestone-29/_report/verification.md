# Support and Buy Again verification

Verified on 12 October 2026 against `develop` at `fb1ad841ddae949e185df6922d3d649033eae978`.

## Delivered behavior

- Buyers create support tickets and appeal their own rejected returns. Shop owners reply to their cases. Administrators manage status, private notes and recorded dispute decisions.
- One unique return relation and an Order transaction lock make concurrent appeals recover the same case. Private notes are excluded before public pagination and counts. Decisions and administrator SYSTEM messages persist atomically.
- Buy Again derives historical quantities from an owned order and merges them with the locked cart using current catalog prices and available stock. Partial and skipped items have explicit results; repeated requests preserve quantities.
- Thai and English pages are reachable from buyer, seller and administrator navigation. Mobile support subjects and evidence wrap within the viewport.

## Checks

| Check | Result |
|---|---|
| Prisma and Prismabox generation | Passed after the nullable unique return-appeal relation was added |
| Migrations | All 23 applied to isolated local test databases |
| TypeScript | `bunx tsc --noEmit` passed |
| Default suite | 185 files / 1,822 tests passed; 35 optional integration files / 253 tests skipped |
| Focused suite with PostgreSQL | 7 files / 63 tests passed, including 7 real database Buy Again/cart concurrency tests |
| Translations | 2,370 keys in each locale; key and placeholder parity passed |
| Optimized Next.js build | Passed with the isolated API rewrite |
| Chromium acceptance | 7 passed, no failures, skips or flaky tests; 40.2 seconds |
| Independent source and comment review | No remaining findings; long-text mobile wrapping fixed before acceptance |

Browser acceptance used the built frontend on port 3190, a development API with mock payments on port 3191, and PostgreSQL 17. The committed runner supports this through `PLAYWRIGHT_SUPPORT_BUILT_FRONTEND=true`; run `bunx playwright test --config playwright.support-repurchase.config.ts` after preparing its isolated environment and build.

The seven journeys proved buyer/seller conversation and private-note isolation, unrelated-account denial, inactive-shop denial, concurrent appeal uniqueness, terminal decisions, current-price repurchase, reserved-stock partial results, concurrent retries and Thai desktop/mobile flows. At 390 CSS pixels, lists, details and rejected-return pickers handled 200-character subjects and long evidence URLs without horizontal overflow.

A real PostgreSQL test injected SYSTEM-message persistence failure after the ticket and decision updates. Both updates and the message count rolled back. Browser comparisons also verified that support and Buy Again leave orders, payments, refunds, returns, inventory, reservations, wallets and coin ledgers unchanged.

An initial broad integration opt-in hit seven pre-existing database-name/port guards. Those guards were preserved. The default suite and this feature's explicit PostgreSQL suite passed separately. Early browser harness failures came from cross-drive dependency resolution, cold development rebuilds, repeated fixture subjects and admin navigation animation; final acceptance used the primary checkout, built frontend, exact ticket IDs and stable pointer interaction.

## Scope and retained evidence

This increment accepts text evidence and grants seller access to active shop owners. Image uploads, shop staff access and automatic compensation remain outside its contract. Dispute decisions record an outcome; financial action uses the existing separate refund workflow. Payment-provider acceptance was not exercised.

Local logs and browser JSON are retained under ignored `.audit/support-repurchase-*`; screenshots remain in `test-results/support-repurchase`. The configured application database was not migrated or seeded. Migrations and fixtures were applied only to disposable `marketplace_test_support_repurchase_20261011` and `marketplace_e2e_support_repurchase_20261011` databases. The user's existing `docs/user-guide.html` change was excluded from all feature commits.
