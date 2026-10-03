# Independent W7 review

The first real PostgreSQL run reproduced two defects: 4 passed / 2 failed in `w7-independent-before.json` and `.log`. Both were fixed after root accepted the findings. The final focused run passed **100 / 100**, with no failed or skipped cases, including **29 actual PostgreSQL cases** across independent review, partial quantity refunds and Return lifecycle. `w7-independent-after.json` / `.log` contain the assertions. `w7-independent-typecheck.log` is empty; the full `bunx tsc --noEmit` command exited zero.

## Findings fixed

1. **Affiliate v2 missing NET silently fell back to legacy gross.** A v2 sale with original buyer NET 94 and included tax 7 was changed to missing buyer NET. Affiliate creation wrongly persisted eligible gross 101 and a ten-cent award instead of refusing the malformed v2 facts. The repository now reads the original ShopSale policy version. The service explicitly selects v1 gross or v2 original NET, requires v2 atomic fields and matching original eligible NET, and rejects unknown versions. Real PostgreSQL tests prove healthy v2 eligible NET 94 / award 9, unchanged v1 eligible gross 8,000 / award 800, missing v2 NET rejection and unknown version 3 rejection.

2. **Refund ledger provenance always recorded version 1.** Both debit and commission-credit entries for a v2 partial refund were tagged with policyVersion 1. The two metadata literals now use the immutable original ShopSale policyVersion. The amounts were already correct; the new PostgreSQL assertion verifies both metadata records are version 2.

## Conservation and race checks

| Risk | Proof |
| --- | --- |
| Concurrent different-item fee completion | Two v2 items own buyer NET 4 and 7, tax 0 and 1. Both plans reserve fee zero. Parallel completion conserves original seller fee 1 and affiliate award 1, reverses NET 11 + tax 1 and leaves seller wallet zero |
| Legacy funded affiliate award | An existing original award without item bases refuses refund completion. Refund remains PROCESSING; no wallet or affiliate effect persists |
| Seller-fault shipping | Buyer shipping NET 100 + tax 7 refunds together. An incurred platform shipping NET 100 + tax 7 is retained. Subsequent full merchandise reversal leaves respectively wallet 0 or retained platform gross 107 |
| Partial rounding | Existing actual PostgreSQL assertions conserve cash 33/33/35, seller fee 2/3/4 and affiliate credits 2/3/4 across original quantity 3 |
| Gross coin restoration | Existing PostgreSQL assertions conserve original gross funding 99/100/101 and restored coin balances 0/1/3, excluding the temptation to restore only NET 280 cents |
| Transaction rollback | Existing PostgreSQL fault injection at affiliate reversal and Return completion leaves status PROCESSING, Return APPROVED and original wallet balance; retry posts one effect |
| Return / Admin state | Parent Order locks serialize admission/approval/completion/failure. Unpaid Return COMPLETED and PROCESSING→PENDING transitions are rejected. Failure releases the Return for a fresh first interval |
| Order projection | Buyer remaining quantity subtracts successful intervals and blocks active Return/refund holds. Buyer and seller tax totals project stored bigint facts; seller totals select owned shops |

Tests use unique fixtures in local `marketplace_test_completion` and never change the global `checkout.tax` setting. No schema, UI, build or commit work was performed in this review. Only the accepted affiliate representation/selector fixes and two refund metadata values were changed.

The fresh source comment pass found no additional financial behavior hidden by new comments or scoped suppressions. A formal no-comments child spawn was unavailable because all four collaboration slots were occupied; no comment deletions or source reshaping were claimed.
