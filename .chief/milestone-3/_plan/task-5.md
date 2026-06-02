# task-5: Verify phone auth with focused tests, typecheck, generation, and documentation updates

## Objective

Verify the phone auth milestone against its goal and contract, and document the resulting local/dev behavior and production SMS gap.

## Scope

- Run required verification:
  - `bun run db:generate`
  - `bunx tsc --noEmit`
  - focused backend phone auth tests
  - focused frontend phone auth/profile tests
  - affected auth regression tests
- Update docs for:
  - phone auth behavior
  - dev/mock OTP provider
  - production SMS adapter out-of-scope/manual future work
  - role model unchanged
- Confirm out-of-scope items remain absent:
  - production SMS vendor adapter
  - phone-only users
  - RBAC tables
  - CAPTCHA/risk scoring

## Constraints

- Do not require real SMS credentials in automated local tests.
- Do not broaden verification into unrelated marketplace domains unless phone auth affected them.
- Do not manually edit generated files.

## Implementation Notes

- Create a task report under `.chief/milestone-3/_report/task-5/` or equivalent milestone report location.
- Include commands run, test results, docs updated, and residual risks.
- If any required command cannot run locally, record the blocker clearly.

## Verification

- Final focused verification commands pass or blockers are documented.
- Report confirms whether the phone auth goal and contract are fully met.
