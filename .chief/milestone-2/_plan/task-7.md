# task-7: Implement trusted social email handling, account linking, and redirect safeguards

## Objective

Ensure Google/Facebook social login only creates or links accounts when the provider supplies a trusted verified email, and ensure social redirects cannot become open redirects.

## Scope

- Enforce trusted provider email behavior:
  - reject missing provider email
  - reject unverified provider email
  - allow local user creation when provider email is verified
  - allow auto-linking to existing local users only when provider verified email matches
  - mark local `emailVerified` true when trusted provider verified email is accepted
- Preserve suspended-user and admin guard behavior after social login.
- Sanitize social login `next` redirect values:
  - allow relative paths starting with `/`
  - reject `//...`
  - reject absolute URLs
  - fallback to default destination for invalid values

## Constraints

- Do not create users with placeholder emails.
- Do not auto-link unverified provider email.
- Do not add profile link/unlink UI or manual link/unlink API.
- Do not expose provider tokens in API responses.

## Implementation Notes

- Use Better Auth hooks/options where possible for trusted email and account linking behavior.
- If Better Auth already provides verified-email semantics, wrap or configure it rather than duplicating provider parsing.
- Reuse the existing `resolveNextPath` behavior where practical, or extract a shared equivalent if both email and social login need it.
- Document any provider-specific limitation discovered during implementation.

## Verification

- Add focused backend tests for trusted email handling where local hooks/wrappers exist.
- Add focused tests for redirect sanitization.
- Run affected auth/user tests.
- Run `bunx tsc --noEmit`.
