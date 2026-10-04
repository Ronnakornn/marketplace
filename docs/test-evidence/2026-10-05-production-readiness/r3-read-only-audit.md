# R3: separate read-only numeric audit boundary

R3 adds the production connection boundary that the existing disposable-only snapshot scanner does not provide. The existing 12 numeric checks, exact-money audit, browser baseline, external comparison tooling and bounded load evidence are retained. Two additional completeness checks were added after actual PostgreSQL reproduction showed blind spots in the original checks. No browser, load, production connection, financial repair, deployment or provider/bank operation was performed for this slice.

## Components and plan

1. Extract the existing invariant SQL without changing its statements or the old scanner's disposable database guard.
2. Pin a separate connection identity, verify transport and PostgreSQL privileges before scanning, and use one READ ONLY / REPEATABLE READ transaction.
3. Return aggregate counts and exact currency/status totals, with no entity identifiers, credentials, address snapshots or customer records.
4. Exercise the real PostgreSQL boundary using disposable reader/writer/owner roles and independently specified monetary fixtures. Preserve unchanged-row evidence and machine-readable exit codes.

Implemented components:

- `scripts/numeric-snapshot-invariants.ts`: the 12 original SQL checks. `r3-invariant-extraction.json` compares the literal SQL against HEAD, normalizing source line endings only; SHA256 is `852474ce7da912f01429f84bd277e9d75871c084d992ee10034e9c71a073cc31`.
- `scripts/verify-numeric-snapshots.ts`: minimal shared-SQL extraction. Its original local disposable `DATABASE_URL` guard remains.
- `scripts/audit-numeric-database.ts`: explicit connection configuration, role/transport validation, snapshot lifecycle, aggregate reporting.
- `scripts/run-numeric-audit.ts`: JSON CLI with exit 0 for all reported checks clear, 1 for stored discrepancies, and 2 for rejected configuration/privileges or unavailable database. Arguments including `--apply` are rejected.
- `scripts/audit-numeric-database.test.ts` and `.integration.test.ts`: 12 configuration cases and 14 actual PostgreSQL cases.

Affected domains are Order, Payment, Inventory, original-sale tax snapshots, Refund, ShopWallet ledger and SellerPayout. No application service, model, migration or generated client was changed. The runner only reads these existing tables; fixture setup, deliberate discrepancy creation/restoration and cleanup use the test administrator outside the audit connection.

## Flow and boundaries

The CLI requires `AUDIT_DATABASE_URL`, `AUDIT_EXPECTED_HOST`, `AUDIT_EXPECTED_DATABASE` and `AUDIT_EXPECTED_ROLE`. It never falls back to the application's `DATABASE_URL`. The URL's host/database/login must match the independent expected values. PostgreSQL's connected database, session/current role and server port must also match. Loopback plaintext connections must actually terminate on a loopback address.

Remote URLs must specify `sslmode=verify-full`; any duplicate mode, weaker mode, alternate SSL parameter or arbitrary connection option is rejected. The PG client receives separate host/port/login/password/database fields and an explicit `rejectUnauthorized: true` TLS object. Optional `AUDIT_TLS_CA_FILE` supplies a private CA; it is not printed. This avoids the [node-postgres connection-string SSL override](https://node-postgres.com/features/ssl).

After connecting, the runner opens `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, pins `public, pg_catalog` search path, and applies a 60-second statement timeout. It verifies the actual transaction settings, then inspects all reachable role memberships, including NOINHERIT roles that can be reached with SET ROLE. A login is rejected for reachable superuser/role creation/database creation/replication/RLS bypass powers, database/schema creation or ownership, relation ownership, table/column writes, or executable non-system SECURITY DEFINER functions. RLS-enabled non-system relations are rejected because their policies could hide rows. This is deliberately conservative: an installation using those facilities needs a separate reviewed audit design. The [PostgreSQL privilege predicates](https://www.postgresql.org/docs/current/functions-info.html) check effective privileges, including grants through PUBLIC and roles.

Numeric scanning begins only after those checks. The 12 original invariants, two additional checks, table counts and totals use the same snapshot, followed by ROLLBACK and disconnection. PostgreSQL [read-only transactions and repeatable read](https://www.postgresql.org/docs/current/sql-set-transaction.html) provide the transactional boundary. The fixed runner issues no temporary-table, apply, row-lock or financial-write statements.

## Non-obvious reporting choices

- All counts and sums remain decimal strings from PostgreSQL; no money is converted to JavaScript Number.
- Orders, shop orders, payments, refunds and payouts are grouped by currency and actual status. Refund has no currency field in Prisma, so its currency is read through its required Payment relation. Ledger has a type rather than status: its groups explicitly use `grouped_by: "type"`.
- The scanner reports stored equations and bounded aggregate facts. It does not establish a complete wallet ledger replay, historical reservation/cache correctness, external settlement or bank transfers. Every report says `externalVerification: "NOT_VERIFIED"`.
- Counts cover Order, OrderItem, ShopOrder, Payment, Refund, SellerPayout, WalletLedgerEntry and Inventory. They are measured rather than inferred from fixture expectations.
- Database exceptions are collapsed to `AUDIT_DATABASE_UNAVAILABLE`; only known boundary codes are printed. A failing connection does not echo a URL, password, SQL statement or customer row.

## Actual evidence and independent literals

The final focused run used PostgreSQL at loopback port 55439, database `marketplace_test_readiness_audit`, with 22 applied Prisma migrations prepared by the coordinator. Dedicated randomized roles were created and dropped only for this disposable harness. Reader fixtures and their dependent rows were cleaned up. The tests also support CI's explicitly supplied local disposable URL; they do not enable production fixture creation.

| Case | Independently specified expectation | Observed proof |
| --- | --- | --- |
| Administrator, UPDATE writer, NOINHERIT writer member, schema creator, relation owner without CREATE, column writer | Reject before numeric callback | All rejected with the expected code; callback never entered; financial row counts/digests unchanged |
| Reader, 12 invariants | PASS and exactly 12 zero counts | Actual reader PASS; CLI exit 0 |
| THB payments | Two fixtures: `9007199254740993` + `7` = literal `9007199254741000`, SUCCEEDED | Exact string amount; separate USD group |
| USD payment | Literal `13`, PENDING, count 1 | Exact string amount/status/currency |
| Refund / payout / ledger | `9007199254740991` SUCCESS / `9007199254740990` paid / `9007199254740989` order_earning | Exact strings above MAX_SAFE; correct groups |
| One-unit stored Payment mismatch | Order `9007199254740993`, Payment `9007199254740994`; exactly one payment snapshot violation | CLI exit 1, `payment_snapshot_amount: "1"`; scanner did not repair it |
| Real forbidden UPDATE outside audit transaction | Role permission rejection | SQLSTATE `42501`; unchanged rows |
| Real forbidden UPDATE inside validated audit snapshot | READ ONLY rejection | SQLSTATE `25006`; unchanged rows |
| Concurrent authorized fixture writer | Both reads within snapshot remain `9007199254740993` | Both literals observed despite intervening committed `9007199254740994` fixture write |
| Apply/global writer fallback | Reject arguments; reject missing explicit audit identity even if DATABASE_URL is a valid writer | Both CLI exit 2; unchanged rows |
| Credentials / PII | No password, buyer email or payment ID in report | Actual CLI output assertions pass |
| V2 item snapshot absent | An existing OrderItem under ShopSaleSnapshot policyVersion 2 must have its correctly linked ItemSaleSnapshot | Additional completeness violation `1`, CLI exit 1; creating a complete original fixture snapshot makes it PASS |
| Shipping-only refund | No item allocation; shipping allocation `20` means cash Refund must equal `20` | Valid `20` PASS; stored `21` yields additional shipping-cash violation `1` and CLI exit 1 |

For repeatable execution on an already populated disposable database, tests capture existing aggregate groups before creating owned fixtures and check the literal increments above. Expected fixture values are not computed using the production invariant SQL or audit aggregation functions. Read-only checks compare counts and hashes of full rows in thirteen financial/inventory/snapshot/allocation tables before and after the actual audit calls. Hashes stay inside the test harness; no customer records appear in evidence reports.

Final raw evidence:

- `r3-completeness-green.json`: **26 tests PASS**, 0 failed, 0 skipped, two test files; focused command exit 0. `r3-tests-final.json` preserves the earlier 24 passing cases before completeness checks were added.
- `r3-completeness-green-observations.json`: actual aggregate reports, privilege failures, forbidden-write SQL states, snapshot observations, additional completeness checks and unchanged-row assertions. `r3-observations.json` retains the earlier 24-case run.
- `r3-command-results.json`: explicitly labelled agent record of observed command exits, including workspace `bunx tsc --noEmit --incremental false` exit 0 before and after the completeness changes. Successful compiler output was empty and Tee-Object did not create a log; no compiler-generated JSON is claimed. The coordinator's final gate provides consolidated proof after freeze.
- `r3-legacy-scanner.json`: original guarded scanner exit 0 after SQL extraction; 12 zero checks on the cleaned disposable database.
- `r3-invariant-extraction.json`: original SQL equality proof.

Earlier `r3-tests-first.json` records a development error in multiple TypeScript declarations, not a pre-existing marketplace defect. `r3-tests-second.json` and `r3-tests-third.json` preserve the intermediate 22/23 passing runs before the extra actual relation-owner coverage. The final report supersedes those intermediate counts.

## Completeness review: reproduced blind spots and narrow fix

An independent source review identified two cases the original SQL could skip. The actual PostgreSQL reproduction is preserved in `r3-completeness-red.json` (**12 passing, 2 failing integration tests**, exit 1) and `r3-completeness-red-observations.json`. Both deliberately invalid fixtures produced audit PASS with all original 12 checks at zero. This is a confirmed scanner completeness issue, separate from the earlier TypeScript development failure.

The production runner now returns `additionalViolations` separately from the original `violations` array. `original_v2_item_snapshot_completeness` starts from the real OrderItems belonging to a version2 ShopSaleSnapshot and verifies a correctly linked ItemSaleSnapshot exists. `shipping_only_refund_cash` covers refunds with shop allocations but no item allocations and compares their amount against allocated shipping cash plus shipping tax. Any nonzero count in either array causes DISCREPANCIES and CLI exit 1. The original 12 SQL checks and the old disposable scanner's behavior remain unchanged; legacy unsnapshotted rows are not newly rejected by the V2-only completeness check.

Positive counterexamples are also executed: creating the complete version2 item snapshot passes, and a shipping-only refund with cash `20` against allocation `20` passes. The one-cent case uses actual stored cash `21` and zero item allocations; no expected value comes from the scanner's SQL. The tests now keep child JSON as unknown until runtime assertions inspect the expected fields, and narrow caught PostgreSQL errors to an Error with a string code instead of asserting an unchecked type.

## Open questions and limits

Actual production host/database identity, dedicated reader provisioning, access authorization and CA configuration remain unavailable. No production numerical audit or remote TLS handshake was executed. Remote TLS validation here is configuration proof; deployment infrastructure must provide the real verified endpoint. The coordinator plans a separate preserved historical e2e dataset read-only run; it is not claimed as executed in this artifact.

The following Poteto principles changed concrete decisions: boundary discipline led to explicit audit environment/identity and privilege rejection before scanning; test behavior led to real forbidden UPDATE attempts and a concurrent committed writer; prove it works led to raw PostgreSQL reports and unchanged-row comparisons; subtract before adding led to reusing the unchanged 12 invariants instead of creating a second formula set. No source commit was created for this slice.
