# Auth v1 Goal

## Objective

Harden the marketplace authentication and authorization foundation around email/password accounts, verified email identity, user profile management, password recovery, and the existing `USER` / `ADMIN` role boundary.

## Scope

- Keep Auth v1 incremental and production-oriented:
  - email/password signup
  - email/password login
  - required email verification
  - OTP-backed email verification and password reset
  - logged-in password change
  - authenticated profile management
  - `USER` / `ADMIN` authorization hardening
- Build on the existing Better Auth integration rather than replacing it.
- Continue using the existing auth macros:
  - `{ withAuth: true }`
  - `{ withRole: 'ADMIN' }`
- Require verified email before protected marketplace flows and admin access.
- Add profile phone support as a future-ready identity field:
  - normalized phone value
  - unique when present
  - `phoneVerified` defaults to false
- Keep phone OTP/login out of Auth v1 implementation.
- Keep social login out of Auth v1 implementation.
- Keep roles limited to `USER` and `ADMIN`.
- Keep admin assignment controlled by seed/admin tooling, not user-facing role request or invite flows.

## Success Criteria

- Users can sign up and log in with email/password through the existing Better Auth-backed frontend flow.
- Newly registered users must verify email before using protected marketplace flows that require trusted identity.
- Verified, active users can access normal authenticated routes.
- Suspended users remain blocked by the auth boundary.
- Admin routes remain inaccessible to non-admin users and unverified users.
- Users can request a new email verification OTP when eligible.
- Users can complete email verification through an expiring OTP.
- Users can request password reset through email OTP without being logged in.
- Users can complete password reset only with a valid, unexpired OTP.
- Logged-in users can change their password only after providing the current password.
- Users can update supported profile fields without changing protected fields such as role, status, or verification state.
- User phone values are normalized before persistence and cannot duplicate an existing user phone.
- Phone values are stored as profile identity data only; phone login and phone verification remain disabled in Auth v1.
- Admin role assignment is not exposed as a public or self-service user flow.

## Out of Scope

- Phone OTP provider integration.
- Phone-based signup or login.
- Phone verification UI or API.
- Social login provider implementation.
- Social account linking or unlinking.
- Full RBAC permission tables.
- Fine-grained admin permission matrix.
- Admin invite flow.
- User-facing admin role request flow.
- Admin password reset on behalf of a user.
- Replacing Better Auth with a custom auth implementation.

## Verification Goal

- Add focused backend tests for:
  - email verification requirement
  - OTP purpose and expiry enforcement
  - password reset OTP behavior
  - logged-in password change validation
  - role/admin guard behavior
  - suspended-user blocking
  - phone normalization and uniqueness
- Add focused frontend tests where practical for:
  - login/signup error states
  - verification-required states
  - password reset/change forms
  - profile update behavior
- Run Prisma generation after schema changes before typecheck/tests.
- Run `bunx tsc --noEmit`.
- Run the relevant Vitest suites for auth, user, and admin route behavior.
