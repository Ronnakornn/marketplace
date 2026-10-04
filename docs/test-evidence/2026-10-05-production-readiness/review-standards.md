# Standards review

Reviewed staged changes using `git diff --cached aabb535 -- .github/workflows/production-gates.yml scripts server/modules/checkout`. Fixed point resolves to `aabb535401bfe99ac831351eeeddd596127a40be`; diff contains 11 files. `git log aabb535..HEAD --oneline` is empty: this is staged work, not a committed range. Source was unchanged during review.

## Documented-standard violations

- **P3 — Validate external values before asserting their types.** `scripts/audit-numeric-database.integration.test.ts:167` uses `JSON.parse(result.stdout) as Awaited<ReturnType<typeof auditNumericDatabase>>`; line 184 uses `(error as { code: string }).code`. Neither cast follows validation. `C:/Users/ASUS/.codex/skills/typescript-best-practices/SKILL.md:17,20,25` requires external data to remain `unknown`, casts only after validation, and parsing at boundaries. The child-process report and caught error should be checked before field access; a small schema for the report fields under assertion and narrowing the error would satisfy the rule. These are test-code standard breaches, not demonstrated production failures.

## Judgment calls

No actionable Fowler smell found. Baseline interpreted as: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, and Refused Bequest are heuristics; repository standards override them and tooling-enforced concerns are excluded. Sharing snapshot invariant SQL removes existing duplication. The audit connection object groups related boundary configuration; operational scripts do not require additional domain-service abstractions.

## Checked boundaries and limits

`scripts/audit-numeric-database.ts:62` starts a repeatable-read, read-only transaction, verifies identity and rejects administrative, owner/creator, direct/inherited table or column writer, security-definer and RLS exposure before scanning. Aggregates remain exact SQL strings. `scripts/assert-ci-integration.ts:42,65` validates complete passing assertions and discovered integration-file coverage. CI routes the two mock-payment title groups to all five browser profiles; production retains real cache/rate-limit settings. `server/modules/checkout/tax-policy.service.ts:8` captures capability at construction consistently with documented restart semantics.

Review is static. No tests, application processes, database operations, or ports were run or changed. Existing full verification belongs to the parent task; this report establishes no new execution result.

**Standards findings: 1, worst P3; judgment findings: 0.**
