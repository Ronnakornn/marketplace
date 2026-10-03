# Exact money representation

Candidate A is the base. Candidate B contributes safe operation inputs,
transaction-bound validation, scalar preservation and the migration census.
Independent same-family review scored A 18 and B 15. Rejecting large lifetime
totals would prevent rounding but would not satisfy the requested exact reports.

Prisma returns actual generated bigint records. Repositories and services keep
money exact. Typed HTTP projections expose canonical signed decimal integer
strings. Eden infers those strings. Provider and webhook numeric protocols retain
their existing checked limits and signatures. Money presentation splits bigint
whole units and fractional digits; ratings and quantities keep their own types.

Cache owns a versioned lossless codec so a cache hit and miss have the same value
and type. Dates, Decimal values and arbitrary JSON strings are not silently
reinterpreted. Existing rounded history requires explicit reconciliation evidence.

Backend and frontend changes are isolated in separate worktrees and integrated as
one coordinated contract change. The current application is the known API caller;
external consumers of numeric response fields must migrate before deployment.
The task does not deploy a half-migrated API.

Literal gates include 9007199254740991 cents ending .91, 9007199254740993 ending
.93, signed debt, a 18014398509481981 lifetime sum, negative one cent, schema/Eden
agreement, actual Prisma transactions, Redis cache parity and browser rendering.
Candidate prototype proof is not a substitute for those application gates.

The source traces, alternatives and independent judgment are in
test-evidence/2026-10-04-audit-completion/money-candidate-exact.md,
money-candidate-bounded.md and money-design-review.md in that directory.
