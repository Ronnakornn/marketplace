# Exact money UI proof

Date: 2026-10-04. Worktree baseline: `9cb0fa3`. Scope: frontend representation, decimal form transport, server-owned cart quote display. No database changes or live browser verification.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `bun run test app --maxWorkers=2 --reporter=default --reporter=json` | PASS: 60 files, 391 tests | [app-tests.log](app-tests.log), [app-tests.json](app-tests.json) |
| `bunx tsc --noEmit` against isolated baseline backend | PENDING integration: five request input type mismatches | [isolated-typecheck.log](isolated-typecheck.log) |
| `git diff --check` | PASS | No whitespace error output |
| Prisma generation | PASS, isolated generated client before tests | `bun run db:generate`, Prisma 7.9.1 |
| Live UI/API/DB reconciliation | NOT TESTED by this unit | Root audit owns live environment verification |

The five type mismatches are the baseline backend's `number`-only `salePriceBaht` and `shippingFeeBaht` request schemas. The coordinating backend implementation accepts `number | string`. No casts hide this mismatch. Integrated typecheck remains required after that backend commit.

## Literal expected outcomes

Expected decimal strings are literals in `app/lib/money.test.ts`, independent of the formatter implementation:

| Accepted source minor units | Expected decimal text |
| --- | --- |
| `-1` | `-0.01` |
| safe number `9007199254740991` | `90071992547409.91` |
| string `9007199254740993` | `90071992547409.93` |
| string `-9007199254740993` | `-90071992547409.93` |
| bigint `9223372036854775807` | `92233720368547758.07` |

Unsafe Number values, fractions, non-finite values, missing required values, noncanonical integer strings, leading zeros and decimal/exponent strings reject. Null/undefined defaults are explicit at individual loading/optional callers. Historical display accepts exact strings above MAX_SAFE; operational numeric conversion remains bounded and rejects above MAX_SAFE. Rejecting unsafe Numbers does not reconstruct digits already lost before the boundary.

Currency formatting preserves two decimal places and locale conventions for English/Thai; negative sub-cent and Arabic digits are covered. Numeric comparison uses BigInt magnitude, including `9` versus `10`. Cosmetic discount percent uses exact integer arithmetic before converting its bounded display percentage.

## Actual paths

- Shared pure `app/lib/money.ts` is consumed by i18n and buyer/affiliate formatters, admin/catalog/moderation/settlement tables, seller finance/catalog/analytics, and marketplace guest displays. All fifteen former formatter owners now use it.
- Product/discovery/buyer/tracking normalizers preserve canonical money strings; required invalid money rejects rather than falling back to zero. Non-money counts and rates keep their existing representation.
- Actual ProductCard tests assert literal above-MAX_SAFE currency labels; actual CartPage tests assert the server selection quote subtotal and quote failure state. CartPage no longer calculates selected business totals from line prices.
- SEO structured data uses exact decimal text. Admin/seller decimal defaults use exact minor-to-decimal conversion. Shipping/flash-sale form payloads retain raw decimal strings through transport.
- Coin balances and transaction signs use BigInt and exact integer formatting. Bounded coin redemption inputs remain Number only after an exact integer bound check.
- Current seller analytics charts plot counts; monetary table and KPI labels use original exact money. No money coordinate conversion was needed.
- `ORDER_SNAPSHOT_RECONCILED` was added to the audit action filter at the parent request.

No frontend pricing business rules, server source, schema, generated output, provider contract or tax/refund policy was changed by this unit.
