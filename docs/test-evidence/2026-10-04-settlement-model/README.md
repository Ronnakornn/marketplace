# Settlement model verification

This evidence covers the documentation increment on 2026-10-04 in Asia/Bangkok.
Application behavior and schema were not changed. The accepted business choice
is that Shops receive Shipping Charges and pay carriers. Discount funding and
commission policy remain pending.

| Check | Result | Evidence |
|---|---|---|
| Typecheck | Exit 0 | [typecheck-result.json](typecheck-result.json), [log](typecheck.log) |
| Vitest | 1,213 passed, zero failed, 39 skipped | [vitest.json](vitest.json), [command result](vitest-result.json), [log](vitest.log) |
| Documentation review | Corrected invalid refund method name and stale shipping decision status. Final source and arithmetic review found no additional document issues. | [settlement-domain-model.md](../../settlement-domain-model.md) |
| Document consistency | 14 local links resolved and eight literal arithmetic checks passed | [document-check.json](document-check.json) |
| PostgreSQL, Redis, browser, provider | Not rerun in this increment | No new evidence claimed |

The 39 skipped tests require optional infrastructure gates. They are not counted
as passed. The previous audit's 1,252-test result with enabled infrastructure
gates belongs to [the earlier evidence](../2026-10-04-numeric/README.md).

Commands executed from the repository root were `bunx tsc --noEmit` and
`bun run test --reporter=json --outputFile=docs/test-evidence/2026-10-04-settlement-model/vitest.json`.

Read-only source explorers covered checkout and finance independently. A separate
GPT-family reviewer checked the current documents and referenced code, including
the two separate refund examples, funding options, cumulative shop rounding,
partial-unit return limits, and the scope of ADR-0004. A model from a different
family was unavailable, so this evidence does not claim cross-family review.
