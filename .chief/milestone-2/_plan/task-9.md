# task-9: Verify social login extension with focused tests, typecheck, and documentation updates

## Objective

Verify the Google/Facebook social login extension against its contracts and document the required environment configuration.

## Scope

- Run final focused verification for social login work:
  - provider configuration tests
  - trusted email/account-linking tests where implemented locally
  - social login UI tests
  - redirect sanitization tests
  - affected auth/user/admin regression tests as needed
- Run `bunx tsc --noEmit`.
- Update environment documentation where env vars are listed.
- Document manual real-provider validation requirements.
- Confirm out-of-scope items remain unimplemented:
  - profile link/unlink UI
  - phone login
  - phone verification
  - providers beyond Google/Facebook
  - RBAC expansion

## Constraints

- Do not require real Google/Facebook credentials in automated local tests.
- Do not broaden docs beyond changed social auth behavior.
- Do not manually edit generated files.

## Implementation Notes

- Add a concise task report under `.chief/milestone-2/_report/task-9/` or equivalent milestone report location.
- If real OAuth callback testing cannot run locally, record it as a residual risk/manual rollout checklist.
- Include the exact commands run and their results.

## Verification

- `bunx tsc --noEmit`
- Focused Vitest suites for changed auth and frontend social login behavior.
- Documentation check for new env vars and provider callback setup notes.
