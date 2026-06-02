# task-3: Implement phone login/signup backend session and account completion flows

## Objective

Complete backend phone login and signup behavior after OTP verification.

## Scope

- Implement login for existing users with `phoneVerified = true`.
- Implement pending signup state for verified phones without a user.
- Implement complete phone signup requiring:
  - verified pending phone state
  - email
  - name
  - password
- Create users from phone signup with:
  - normalized phone
  - `phoneVerified = true`
  - `role = USER`
  - `status = ACTIVE`
- Preserve Auth v1 email/password behavior and email verification rules.
- Ensure suspended users cannot use phone login to bypass auth guards.

## Constraints

- Do not create phone-only users.
- Do not create placeholder emails.
- Do not bypass password policy.
- Do not bypass role/admin guards.
- Do not implement production SMS vendor behavior.

## Implementation Notes

- Prefer Better Auth APIs for account/session creation where possible.
- If direct Better Auth session creation is not practical, document the chosen safe integration point and cover it with tests.
- Pending signup tokens/states must expire and must not be reusable.
- Duplicate phone and duplicate email conflicts must be handled cleanly.

## Verification

- Add backend tests for:
  - verified phone login success
  - unverified phone login rejection
  - suspended phone user rejection
  - new phone pending signup
  - complete signup success
  - duplicate phone rejection
  - duplicate email rejection
  - pending signup expiry/reuse rejection
- Run focused auth/user tests.
- Run `bunx tsc --noEmit`.
