# Cumulative refund allocation verification

This backend increment fixes repeated order-wide refund rounding. It does not
select discount funding, commission reversal, shipping refundability, or seller
debt policy. The domain glossary and shipping entitlement ADR precede the fix.

## Red and green

The red PostgreSQL regression is committed in `fa3c4f8` before implementation.
Two Shops paid 1 minor unit each. Two refunds of 1 produced `[0,-2]` instead of
the literal expected `[-1,-1]`.

[red.log](red.log) contains the assertion failure. [green-repro.log](green-repro.log)
contains the passing same-surface test, extended with replay and seller wallet
service response checks. The `-t` runs intentionally omit unrelated cases.
Their skips are not claimed as passed. The final suite executes every commerce
database case.
Runner logs retain their original blank lines at the end of output.

## Final checks

| Check | Result | Evidence |
|---|---|---|
| All Vitest, PostgreSQL gates enabled | 1,279 passed, zero failed, two skipped | [final-vitest.json](final-vitest.json), [command result](final-vitest-result.json), [log](final-vitest.log) |
| Commerce PostgreSQL | 20 passed, zero skipped | The commerce file result in final-vitest.json |
| Amount and repository units | 9 and 23 passed, zero skipped | Their file results in final-vitest.json |
| Typecheck | Exit zero | [result](final-typecheck-result.json), [log](final-typecheck.log) |
| Finite arithmetic probe | 9,261 states, 55,566 order plans, 74,088 targeted plans, zero failures | [script](arithmetic-invariants.ts), [output](arithmetic-invariants.json) |
| Separate source and comment review | No blocking issues, zero proposed comment deletions, no new suppressions | [design](../../refund-allocation-design.md) and decision trail |

The two skipped tests are `catalog-cache.integration.test.ts` and
`queue-expiry.integration.test.ts`, which require Redis. PostgreSQL was isolated
at `127.0.0.1:55439/marketplace_test_numeric`. No default-port service, browser,
external payment/refund provider, production runtime, or Redis 7 evidence is
claimed by this increment.

## Database scenarios

| Scenario | Literal expected committed behavior | Focused evidence |
|---|---|---|
| Sequential refunds of 1/1, with replay | Shop debit totals -1/-1; wallet service amounts -1/-1 | [green-repro.log](green-repro.log) |
| Different refunds completed simultaneously | Both SUCCESS, totals -1/-1 | [green-concurrent.log](green-concurrent.log) |
| Caps 2/1/2, decreasing ideal component | After three refunds of 1, totals 0/-1/-2; full remaining refund gives -2/-1/-2 | [green-nonmonotone.log](green-nonmonotone.log) |
| Targeted shop refund before order-wide remainder | First totals -100/0, then -100/-100 | [green-mixed-return.log](green-mixed-return.log) |
| Targeted 60 when shop has 50 remaining | 409, refund remains PROCESSING, totals -50/-50 | [green-overreturn.log](green-overreturn.log) |
| SUCCESS history missing debits | 409, new refund remains PROCESSING, no new ledger entry | [green-missing-history.log](green-missing-history.log) |
| Legacy shop cap1 already debited2 | 409, old -2/0 retained, no new ledger entry | [green-overdrawn-history.log](green-overdrawn-history.log) |

These fixtures intentionally exercise repository accounting, including negative
wallet balances before earnings. They do not establish when a real return may
be approved or prove external cash transfer. Existing PostgreSQL coin-failure
rollback and duplicate-completion tests also pass in the final commerce suite.

The cross-payment-attempt history regression is a repository unit fixture with
prior debit 2,000 on another payment record and new debits 4,000/4,000.
[worker-cross-payment.log](worker-cross-payment.log) records its passing run.
It is not provider reconciliation evidence.

## Limits and review

The finite arithmetic script exercises three shops with caps 0 through 5 and
every valid consumed amount. It checks nonnegative debits, exact conservation,
remaining caps, feasible cumulative targets, full-refund exhaustion, and targeted
shop isolation. It does not establish arbitrary partial split-versus-lump equality.

The independent judge selected cumulative deficits over remaining-capacity
weights, and the source reviewer found no blocker. The reviewer identified
cross-payment history coverage, which was added before the final suite. All
reviewers available here are from the GPT family, so this is not cross-family
review. The retained exported API-contract comment is within the comment-review
exception. No comments were deleted or restored, and no constraint encoding was
requested.

The global Prisma extension still converts individual BigInt values to Number.
An unsafe legacy value may lose precision before this calculator sees it. The
calculator's BigInt intermediates do not repair that pre-existing serialization
limit. Inconsistent legacy refund history now blocks new completion with 409 and
requires separate reconciliation; this fix does not rewrite old financial rows.

## Reproduction

After starting the task-owned isolated PostgreSQL cluster from the earlier
numeric audit, run from the repository root:

```powershell
$env:COMMERCE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_numeric'
$env:QUEUE_TEST_DATABASE_URL=$env:COMMERCE_TEST_DATABASE_URL
bun run test --reporter=json --outputFile=docs/test-evidence/2026-10-04-refund-allocation/final-vitest.json
bunx tsc --noEmit
bun run docs/test-evidence/2026-10-04-refund-allocation/arithmetic-invariants.ts
```

The integration suite rejects nonlocal databases and names without
`marketplace_test_`. Synthetic failing and corrupt-history fixtures remain in
the disposable database for inspection. No production data was changed.

The task-owned PostgreSQL server was stopped after the final run. Redis was not
started for this increment. [cleanup-result.json](cleanup-result.json) records
the stop and subsequent no-server status; retained database files were not deleted.
