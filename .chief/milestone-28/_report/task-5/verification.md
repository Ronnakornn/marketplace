# Milestone 28 Task 5 Verification

## Scope

Re-verified Task 5 after `0bbbdfb` against the current worktree. Existing
dirty Chief plan files were preserved; this report is the only verifier edit.

## Commands and Results

| Command | Result |
| --- | --- |
| `bun run db:generate` | PASS — Prisma Client 7.8.0 and Prismabox generated. |
| `bunx tsc --noEmit` | PASS. |
| `bun run audit:i18n` | PASS — 1,853 EN/TH keys and placeholder parity. |
| `bun run test` | PASS — 115 files, 859 tests (33.55s). |
| `bun run build` | PASS — production build completed (14.7s). |
| `bun run db:push` | PASS — database already synchronized. |
| `bunx playwright test e2e/storefront.spec.ts --project=storefront-chromium` | All 6 tests reported PASS (0.15s, 4.3s, 1.3s, 1.1s, 6.9s, 3.7s); outer command nevertheless timed out at 180s instead of exiting 0. Post-run check found no listeners on ports 3000 or 3001. |

## Storefront Browser Evidence

The focused run started a clean dev stack, passed readiness at
`/api/health/ready`, seeded deterministic fixtures, and explicitly reported:

- `public UUID and slug APIs resolve active shops without private fields` — PASS.
- `English desktop and Thai mobile share storefront chrome, media, and localized policies` — PASS.

Generated screenshot evidence:

- `test-results/milestone-28/storefront-en-desktop.png`
- `test-results/milestone-28/storefront-th-mobile.png`
- `test-results/milestone-28/storefront-owner.png`

Visual inspection of the EN desktop screenshot confirms the cover/logo identity,
localized description, shared buyer top bar, buyer actions, reviews/policies,
and expanded shipping-policy text. The test logs also confirm 200 responses for
UUID and slug profile lookups and 404 for the suspended shop; the test asserts
the absence of owner/contact/settings fields.

## Legacy E2E Triage

The seller-product-studio, seller-workflows (inventory and orders/returns), and
Thai mobile seller-route E2E suites were introduced in `4ed9e69`, before the
M28 task commits (`4474e52` onward). They are seller-only paths and do not
exercise storefront routes or shared Storefront components. Their previous
timeouts therefore are **legacy/out-of-scope E2E instability**, not a confirmed
M28 regression. `d2becde` removes the brittle `networkidle` readiness wait,
but no full legacy E2E pass was produced in this verification session.

## Final Focused Browser Result

All six storefront scenarios reported PASS. The server lifecycle cleanup left
no TCP listeners on ports 3000 or 3001. The outer test command still failed to
return before its 180-second watchdog, so an exit-code-zero confirmation is
not available from this run.

## Residual Risk

- The focused storefront command did not exit before the external 240s command
  deadline despite generating browser evidence. Investigate Playwright/dev-server
  child-process shutdown and retain a completed result summary.
- A complete `bun run test:e2e` legacy run remains required for the repository
  gate; failures in seller flows must be tracked separately from M28.

## Readiness Decision

**Ready for Task 5 storefront scope:** deterministic gates pass and all six
focused storefront browser/API scenarios report PASS, with screenshots retained.
The Playwright command-exit anomaly and legacy seller E2E failures remain
documented, accepted residual risks outside the M28 storefront acceptance scope.
