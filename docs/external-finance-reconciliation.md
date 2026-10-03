# External finance reconciliation

W9 prepares a read-only local comparison. No provider or bank sandbox has been selected. A matched local comparison cannot establish that money moved externally.

## Implementation plan

1. Ground Payment, Refund and SellerPayout identifiers, references, status and currency in generated Prisma models. Derive their transport fields with TypeBox composition. Keep external records as a discriminated union by PAYMENT, REFUND or PAYOUT.
2. Validate an explicitly supplied record manifest and original record file at the CLI boundary. Reject malformed amounts and local database connections outside disposable test names.
3. Reconcile final source sequences against a consistent read-only PostgreSQL snapshot. Exact duplicates are ignored. Conflicting duplicates, reused references, scope gaps and mismatches become machine-readable discrepancies. Sum canonical minor units with bigint, separately by kind and currency.
4. Prove the CLI with literal supplied fixtures and PostgreSQL match/mismatch/reference/currency/duplicate cases. Record the read-only transaction setting, attempted write count and unchanged financial rows. Commit only this slice.

Throughput checkpoint. The first gate is the input and database boundary. Pure rules and CLI/database proof share one source file and serialize. Other workers own money/tax/UI, so this slice owns only this script, its tests and these documents. One worker is the smallest safe decomposition because the CLI is a single comparison command. Parallel design delegates are unavailable under the parent's current harness limit; the parent independently reviews this owned diff.

The rejected alternative was a provider-specific network adapter. Provider identity, sandbox protocol and evidence acquisition are missing, so no adapter or external pass can be implemented from current facts. The chosen structure uses a typed source-record union and maps by operation/event identity. Model the Domain removes mixed payment/refund/payout field bags. Boundary Discipline keeps validation at input and pure reconciliation independent of PostgreSQL. Prove It Works requires actual CLI runs over PostgreSQL, not a mock database.

## Required external evidence

Still required are the provider and bank names, sandbox endpoints and test account/recipient mapping, authentication mechanism, signature verification specification and key provenance, idempotency/event ordering contract, currency minor-unit exponent and gross/fee/net interpretation, refund and payout status mappings, and a documented acquisition method for original sandbox records. These facts must come from the selected provider/bank, not guessed status names.

An operator-supplied file and its SHA-256 can establish local file integrity. They do not authenticate a provider, verify a webhook signature, prove a bank recipient, or prove transfer completion. Any future verified adapter must preserve the original record and document its mapping to this comparison format.

## Run the local comparison

Supply the original acquired file and a separately reviewed normalized manifest. The tool checks the manifest's SHA-256 against the original bytes. It cannot verify the semantic mapping or authenticity of those bytes because the provider protocol is unspecified.

```powershell
$env:COMMERCE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_completion'
bun run scripts/reconcile-external-finance.ts --input records.manifest.json --original original-records.json --currencies THB
```

Only `COMMERCE_TEST_DATABASE_URL` is used. The runner accepts postgres/postgresql on localhost or127.0.0.1, with database names beginning marketplace_test_, marketplace_e2e_ or e2e_. It rejects query/hash connection overrides and all production/remote names. There is no apply option. Input and original files are each limited to10MiB, records to10,000 and each scope ID list to10,000. Missing flags, invalid input, a hash mismatch or connection errors exit2 with JSON.

The manifest has `formatVersion`1, `source`, `scope` and `records`. `source.kind` is fixture or operator_supplied; name and mappingDescription describe acquisition/mapping without asserting verification. `originalSha256` is the lowercase64-digit SHA-256 of the original file. `scope` explicitly selects paymentIds, refundIds and payoutIds. A nonempty scope is required, and every selected local row requires a final supplied record. Extra records outside that scope and missing local rows are discrepancies. Scope selection does not claim completeness of a provider statement or all local finance rows.

Each record has kind, local id, globally unique recordId, nonnegative safe integer sourceSequence, canonical nonnegative integer string amount, uppercase three-letter currency and nonempty externalReference. Amounts cannot exceed PostgreSQL signed BigInt maximum9,223,372,036,854,775,807. Currency must be explicitly allowlisted with `--currencies`; currencies are never converted or combined. The allowlist is operator configuration, not verification of an ISO/provider exponent or supported settlement currency.

| Kind | Additional fields derived from generated models | Local reference and relation |
| --- | --- | --- |
| PAYMENT | orderId, provider, Payment status | Payment.providerIntentId; Order ID, grandTotal and currency checked |
| REFUND | orderId, paymentId, provider, Refund status | Refund.externalReference; payment/order relation and their currencies checked |
| PAYOUT | walletId, shopId, SellerPayout status | SellerPayout.externalReference; wallet/shop relation and currency checked |

Generated entity status schemas are reused. The manifest status is a reviewed mapping to the local model, not an assumed external API status. Payment uses REQUIRES_ACTION/PENDING/SUCCEEDED/FAILED/CANCELED/REFUNDED. Refund uses PENDING/PROCESSING/SUCCESS/FAILED. Payout uses requested/approved/rejected/paid/cancelled. Pending refund/payout rows without an external reference cannot claim a successful match and report LOCAL_REFERENCE_MISSING.

Source sequence must come from the selected provider's documented ordering or a reviewed statement normalization. The highest sequence is compared to current local state, regardless of input arrival order. Exact same-recordId replays are ignored and counted once. Conflicting replays, conflicting equal sequences, changed immutable facts in older records and references reused by different operations reject the comparison. Historical status differences at lower sequences are allowed. These rules do not assert that all provider transition histories or omitted events are valid.

PostgreSQL uses REPEATABLE READ plus SET TRANSACTION READ ONLY for the snapshot. The JSON report includes localComparison, externalVerification, scoped matched counts, duplicate counts, discrepancies and totals grouped by operation kind and currency. Totals are sums of the final recorded book amounts at their statuses, not independently verified bank settlements, net fee balances or an accounting ledger net. Each total has localAmount, recordAmount and record-minus-local difference as exact strings. A field/reference/status/currency/relation/scope discrepancy exits1. A local match exits0 but always retains externalVerification NOT_VERIFIED.

## Executed proof and remaining work

[Combined log](test-evidence/2026-10-04-audit-completion/external-finance-combined.log) records33 passing cases, including26 pure cases. They cover malformed minor units, exact aggregate9,007,199,254,741,000, duplicate/out-of-order/conflict handling, relation/reference/status/currency mismatch, missing scope rows and local database guards. A flagged inconsistent local relation cannot increment the matched count. Provider/reference tuple identities remain distinct when either component contains a colon.

[CLI PostgreSQL log](test-evidence/2026-10-04-audit-completion/external-finance-pg.log) records seven passing actual subprocess cases over the local migrated database. [Machine-readable reports](test-evidence/2026-10-04-audit-completion/external-finance-cli.json) retain actual exit codes and READ ONLY state. Literal fixture payment9,007,199,254,740,993, refund9,007,199,254,740,991 and payout9,007,199,254,740,990 match exactly. A payout discrepancy of one minor unit exits1. Unknown currency/reference, wrong refund payment relation, conflicting duplicate and unmatched scope reject. Exact duplicate/out-of-order records exit0 and count three operations once. An original-file hash mismatch exits2 before database connection.

The six database-reading subprocess cases record databaseReadOnly true and zero write statements observed through Prisma query events. Targeted Payment/Refund/Payout/ShopWallet rows and payout ledger count are unchanged after every case, including input rejection. Fixture setup writes are outside the CLI and explicitly labeled generated fixtures. They are not external provider or bank proof.

[Standalone typecheck log](test-evidence/2026-10-04-audit-completion/external-finance-typecheck.log) still exits2 for44 inherited frontend money diagnostics at the isolated c3142a7 base. No diagnostics refer to this script, these tests or server code. Root owns the final integrated typecheck/build/browser gates.

| Gate | Status |
| --- | --- |
| Pure exact comparison and input boundaries | Passed26 cases |
| Actual local PostgreSQL CLI and no financial writes | Passed7 cases |
| Original provider records acquisition/signature/provenance | Not tested; provider unspecified |
| Provider sandbox charge/refund execution | Not tested |
| Bank sandbox payout execution and recipient verification | Not tested |
| Statement completeness, fees/net settlement and currency exponent mapping | Not tested |
| Final integrated whole-repository checks | Root gate pending |
