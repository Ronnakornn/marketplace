# Payment and checkout operation boundaries

The initial public `PaymentService.handleWebhook` regression run recorded **21 passed / 8 failed**, preserved in `payment-boundary-before.json` / `.log`. Negative, fractional, unsafe and nonfinite webhook amounts reached a repository transaction; NaN on an already-processed event reference returned success. Mismatch diagnostics also emitted money as raw numbers.

The service now rejects amounts outside nonnegative safe integer minor units before logging or starting a transaction. The tests verify no webhook/payment locks, reads, event writes, state changes, affiliate creation, shipment creation or event publishing occur. The malformed replay case is rejected before the idempotency lookup. Valid amount endpoints 0 and 9,007,199,254,740,991 retain ordinary settlement behavior. Near-boundary mismatch diagnostics return exact canonical strings `9007199254740991` and `9007199254740990`.

The HTTP input schema remains the existing numeric provider contract. Provider signatures and valid event bodies are unchanged. Internal callers receive the same monetary validation as HTTP callers through the service boundary.

The parent's integrated pre-fix run exposed an unsafe seller gross that could exceed the operation limit even when discounted buyer cash fit. The repository now translates only the checked money helper's `MoneyAmountError` into `CheckoutServiceError` with HTTP 409 / `INVALID_MONEY_AMOUNT`, before checkout/order/payment writes. Other errors are rethrown. Existing stale unit assertions were updated to literal bigint shop totals; bounded quote input numbers remain unchanged.

Final verification: **65 passed / 0 failed / 0 skipped** across all payment tests and checkout repository tests. `payment-checkout-boundaries-after.json` / `.log` contain the proof. Full `bunx tsc --noEmit` exited zero; `payment-checkout-boundaries-typecheck.log` is empty. No schema change or commit was made.
