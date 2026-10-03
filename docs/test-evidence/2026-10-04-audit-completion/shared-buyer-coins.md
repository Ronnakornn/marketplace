# Shared buyer wallet proof

Three actual PostgreSQL cases passed without skips. Two independently delivered
orders use different seller wallets and the same buyer coin wallet. Both refund
transactions reach that wallet before either proceeds. Each recorded sale spent
five coins and awarded eight cashback coins. Each full merchandise refund restores
five coins and reverses eight. These are supplied original reward facts; this
fixture does not verify the checkout cashback-rate calculation.

With zero available coins the literal expected final balance is zero and debt is
six. With 16 available coins the expected final balance is 10 and debt is zero.
Both cases finish with lifetimeSpent and lifetimeEarned zero, four reward ledger
rows and wallet version five. Replay writes nothing.

The failure case injects an unavailable coin ledger after updates begin. Buyer
balance, refund status and seller entries roll back together. Retrying creates
one seller debit of 8000 and one original fee credit of 800, then leaves buyer
balance 13, lifetimeSpent five and lifetimeEarned eight. No bug was observed.

`shared-buyer-coins.json` and `.log` contain the executed assertions. The driver
warned about parallel queries on one transaction connection. That warning is
recorded; the concurrency tests passed without a widened timeout. Final root
checks will repeat the cases after representation and partial-refund changes.
