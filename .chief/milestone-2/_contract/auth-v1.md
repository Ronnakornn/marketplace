# Auth v1 Contract

## Access Contract

- Auth v1 must build on the existing Better Auth integration.
- Protected marketplace APIs must use `{ withAuth: true }`.
- Admin APIs must use `{ withRole: 'ADMIN' }`.
- Auth guards must reject:
  - missing or invalid sessions with 401
  - suspended users with 403
  - unverified users on routes requiring verified identity
  - non-admin users on admin routes
- Do not duplicate inline authorization checks across handlers when an auth macro can express the rule.
- Route handlers may perform resource ownership checks after authentication when the resource belongs to a user, shop, or admin-only workflow.

## Role Contract

- System roles remain limited to:
  - `USER`
  - `ADMIN`
- Do not add role/permission tables in Auth v1.
- Do not add user-facing admin invitation or admin request flows.
- Admin assignment remains controlled by seed/admin tooling.
- Any existing admin role mutation endpoint must remain admin-only and must prevent self-demotion or accidental removal of the last viable admin where practical.

## User Schema Contract

- Extend `User` with nullable phone fields:
  - `phone`
  - `phoneVerified`
- `phone` must be normalized before persistence.
- `phone` must be unique when present.
- `phoneVerified` defaults to false.
- `phoneVerified` must not be client-writable through profile update APIs.
- `role`, `status`, `emailVerified`, and verification state fields must not be writable through normal profile APIs.
- Schema changes must go through `prisma/schema.prisma`.
- Run Prisma generation after schema changes before typecheck/tests.

## Email Verification Contract

- Email/password signup creates a user that must verify email before accessing verified-only protected flows.
- Email verification uses an expiring OTP or token with explicit purpose `EMAIL_VERIFICATION`.
- Email verification OTPs must not be reusable for password reset.
- Verification completion must:
  - validate purpose
  - validate expiry
  - validate target identifier
  - mark `emailVerified` true only for the intended user
  - consume or invalidate the verification record
- Resend verification must be rate-limited or otherwise guarded against abuse where practical.
- Verified users should not receive unnecessary new verification OTPs.

## Password Contract

- Logged-in password change requires:
  - active authenticated session
  - verified email
  - current password
  - new password meeting policy
- Password reset uses an expiring OTP or token with explicit purpose `PASSWORD_RESET`.
- Password reset OTPs must not be reusable for email verification.
- Password reset completion must:
  - validate purpose
  - validate expiry
  - validate target identifier
  - update only the intended user's password credential
  - consume or invalidate the reset record
- Password reset must not reveal whether an email exists through user-visible response differences.
- Admin reset-password-on-behalf-of-user is out of scope.

## Profile Contract

- `/api/me` remains the authenticated current-user read endpoint.
- `/api/me` update may support:
  - `name`
  - `image`
  - `phone`
- Profile updates must not allow users to modify:
  - `role`
  - `status`
  - `emailVerified`
  - `phoneVerified`
  - password fields
- Phone update must normalize and enforce uniqueness before persistence.
- Updating phone in Auth v1 must leave `phoneVerified` false unless a later phone verification flow explicitly verifies it.

## API Contract

- Prefer extending existing auth/user modules rather than creating a parallel auth system.
- Better Auth endpoints remain mounted through the auth plugin.
- Add adjacent first-party endpoints only for behavior not cleanly covered by Better Auth defaults, such as:
  - resend email verification OTP
  - verify email OTP
  - request password reset OTP
  - complete password reset
  - change password for current user
- API request validation must use TypeBox / Prismabox patterns.
- API responses must avoid leaking sensitive auth details, password hashes, OTP values, or provider tokens.
- Frontend requests must use same-origin `/api/*` paths.

## Frontend Contract

- Keep auth UI under the existing auth feature and App Router pages.
- Login/signup forms continue to use Better Auth client helpers where appropriate.
- Add UI states for:
  - verification required
  - resend verification
  - verify OTP
  - forgot password
  - reset password
  - change password
  - profile phone update
- Frontend types must stay inferred from Eden Treaty or Better Auth client types where applicable.
- Do not duplicate backend response DTOs manually in frontend code.
- Forms must preserve user input after mutation failures where practical.

## Future Extension Contract

- Phone OTP/login is intentionally out of scope for Auth v1.
- Social login is intentionally out of scope for Auth v1.
- A future phone auth milestone must define:
  - SMS/OTP provider
  - rate limits
  - OTP delivery audit behavior
  - phone verification UX
  - account recovery and account linking rules
- A future social auth milestone must define:
  - supported providers
  - callback URL policy
  - account linking/unlinking behavior
  - duplicate email handling
  - provider token storage rules

## Verification Contract

- Backend tests must cover:
  - auth guard rejection for missing sessions
  - suspended-user blocking
  - unverified-user blocking on verified-only routes
  - admin guard rejection for non-admin users
  - OTP purpose separation
  - OTP expiry behavior
  - OTP consumption/idempotency behavior
  - email verification success path
  - password reset success path
  - logged-in password change requiring current password
  - profile phone normalization and uniqueness
- Frontend tests should cover the main form states where practical.
- Verification commands:
  - `bun run db:generate` after Prisma changes
  - `bunx tsc --noEmit`
  - focused Vitest suites for auth/user/admin behavior
