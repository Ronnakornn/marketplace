# task-2: Implement Auth v1 backend verification, password, profile, and guard behavior

## Objective

Implement backend Auth v1 behavior for verified identity, OTP purpose separation, password flows, profile phone updates, and auth guard enforcement.

## Scope

- Extend auth/user services and repositories rather than creating a parallel auth module.
- Add backend behavior for:
  - resend email verification OTP
  - verify email OTP
  - request password reset OTP
  - complete password reset
  - logged-in password change
  - profile phone update
- Ensure OTP records are purpose-scoped:
  - `EMAIL_VERIFICATION`
  - `PASSWORD_RESET`
- Update auth guards or add verified-user guard behavior so verified-only protected flows reject unverified users.
- Keep admin routes protected by `withRole: 'ADMIN'`.

## Constraints

- Never expose OTP values, password hashes, provider tokens, or sensitive auth internals in API responses.
- Password reset request responses must not reveal whether an email exists.
- Do not use inline duplicated authorization when an auth macro should express the rule.
- Do not trust client-provided role, status, or verification state.

## Implementation Notes

- Prefer Better Auth APIs for password credential operations when available.
- If custom verification records are needed, use the existing Better Auth-compatible `Verification` model where practical and encode purpose explicitly.
- Add small utility functions for phone normalization and OTP purpose parsing only if they remove meaningful duplication.
- Keep services responsible for business rules and repositories responsible for database access.

## Verification

- Add backend tests for:
  - OTP purpose separation
  - OTP expiry
  - OTP consumption/idempotency
  - email verification success
  - password reset success
  - logged-in password change requiring current password
  - phone normalization and uniqueness
  - unverified-user guard behavior
