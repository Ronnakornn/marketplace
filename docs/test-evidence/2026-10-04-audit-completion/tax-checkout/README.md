# Tax checkout proof — 2026-10-04

`core-140.json` / `.log`: 140 passed, 0 failed, 0 skipped. The original 14 PostgreSQL cases are included in that run.

`reviewed.json` / `.log`: 183 passed, 0 failed, 0 skipped after adding negative snapshot guards and the actual payment repository/service/routes/settlement regression files. This includes 17 PostgreSQL cases and 11 pure literal sale economics cases. Expected monetary values in the tests are literal amounts, separate from the implementation's formulas.

`database.json` records the dedicated `marketplace_test_tax` database, PostgreSQL version, all 22 migration checksums and completion states. The tax and affiliate additive migrations both ran through Prisma migrate deploy. Tests do not modify `marketplace_test_completion`. `checkout.tax` is deleted from the dedicated test database after each case.

`typecheck-final.log` records the final full inferred TypeScript check. An empty log plus the reported zero command exit status is success. `typecheck.log` preserves the earlier clean check.

## Proven paths

| Case | Literal outcome / evidence |
| --- | --- |
| Inclusive merchandise | Gross 10,700; NET 10,000; included tax 700; added tax 0; original fee 1,000; wallet 9,700 |
| Exclusive merchandise | NET 10,000; added tax 700; paid 10,700; original fee 1,000; wallet 9,700 |
| Live tax and commission changes | Original snapshots govern recognition after changing the live tax rate and injecting a different current commission service |
| Duplicate webhook / repeated earning | One cashback award and exactly two earning/fee ledger entries |
| Cashback threshold | Inclusive gross 10,699 has original buyer NET 9,999, so no cashback coin |
| Taxable platform shipping | Shipping gross 1,070; NET 1,000; tax 70. Inclusive tax is platform funded; exclusive added tax is buyer funded. Seller wallet 10,770 in both cases |
| Coupon stack | 10,000 − shop 1,000 − platform 10% of 9,000 (900) − coins 500 + shipping 400 = paid 8,000; wallet 8,500 |
| Both coupon rights | Two RESERVED redemptions, later converted by the real webhook; no replacement coupon |
| Late coupon failure | Injected failure on the second redemption write rolls back first redemption, order, stock reservation, coin movement and leaves cart intact |
| Last platform right race | Two concurrent checkouts produce one order, one platform reservation, one shop reservation; losing stock remains unreserved |
| Acceptance | Missing v2 fingerprint, changed revision or changed price is rejected before order/payment/stock/coin writes |
| Rollout guard | Nonzero tax is rejected while v2 support is disabled |
| Partial refund before earning | Quantity 1 of original 2 returns NET 10,000 + tax 700. Initial wallet recognizes only remaining gross 10,700 − original fee 1,000 |
| Corrupt frozen facts | Missing buyer NET, negative original shipping, negative seller waiver or negative coupon rejects earning without ledger entries or recognized timestamp |
| Allocation ties | Reversed input selection produces the same fingerprint. Stable cart item order receives discounts [0, 1], retained under fresh order item IDs |
| Tax configuration | Generic config path rejects incomplete nonzero policy and wrong storage type. Complete policy gets a fresh revision and full before/after audit. ADMIN macro protects dedicated endpoints |
| API money representation | Included/added/reported tax and all money fields are canonical decimal strings; fingerprint/revision remain unchanged strings |

## Review notes and limits

The tax implementation retains bigint for formula/allocation arithmetic and rejects unsafe operational amounts before writing. `taxTotal` remains added tax; included and reported totals are separately disclosed. Commission uses original merchandise NET. Seller receipts include original merchandise and shipping NET plus TAX. Cashback and affiliate eligible facts freeze original buyer NET.

Version 1 snapshot readers remain intact. No tax facts are inferred for old nullable records. Version 2 validators require every atomic fact and supported policy; they reject negative components and inconsistent gross/NET/TAX identities. Wallet also validates original quantity, item identity, currency and unit-price/extended-line agreement.

The runtime flag `CHECKOUT_V2_SETTLEMENT_ENABLED` remains false unless explicitly enabled. Dedicated tests inject v2 support locally. Production activation still depends on the parent task's refund/affiliate/UI/full-suite gates. This proof does not claim browser testing or a production build.

Tax rates and funding basis are operator-selected policy. The 70,000 PPM rate is a test fixture, not a statement of applicable law. Inclusive extraction versus exclusive addition and discount/rounding semantics were checked against [Stripe's official tax-rate documentation](https://docs.stripe.com/tax/tax-rates); the Thai revenue department's [inclusive-tax worked example](https://vrtweb2.rd.go.th/15.html) supports the arithmetic example only.
