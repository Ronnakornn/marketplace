# Phone Auth Contract

## Schema Contract

- Add a dedicated `PhoneOtpChallenge` model.
- `PhoneOtpChallenge` must support:
  - `id`
  - normalized `phone`
  - purpose
  - OTP hash or equivalent non-plaintext verifier
  - attempts count
  - max attempts
  - resend availability timestamp
  - expires timestamp
  - consumed timestamp
  - revoked timestamp or status
  - created timestamp
  - updated timestamp
- Phone OTP purposes must be explicit, such as:
  - `PHONE_LOGIN`
  - `PHONE_SIGNUP`
  - `PHONE_LINK`
- Existing `User.phone` remains unique when present.
- Existing `User.phoneVerified` remains the source of truth for whether a phone can be used as a login identity.
- Schema changes must go through `prisma/schema.prisma`.
- Run Prisma generation after schema changes before typecheck/tests.

## OTP Provider Contract

- Implement an OTP provider abstraction for phone delivery.
- Include a deterministic dev/mock provider for local development and tests.
- Do not bind this milestone to a production SMS vendor.
- Do not log raw OTP codes in production mode.
- Tests may inspect deterministic mock OTP behavior without external network calls.
- Provider failures must produce safe user-facing errors without exposing internals.

## OTP Security Contract

- OTP challenges must expire.
- Successful OTP verification must consume the challenge.
- Consumed, expired, or revoked challenges cannot be reused.
- Wrong OTP attempts must increment attempts.
- Attempts must be capped per challenge.
- OTP resend must observe cooldown.
- OTP request frequency must be capped per normalized phone per time window.
- OTP values must not be stored as plaintext.
- Phone values must be normalized before challenge creation and lookup.

## Phone Login Contract

- Phone login begins by requesting an OTP for a normalized phone.
- If a user exists with the normalized phone and `phoneVerified = true`, successful OTP verification may create or complete a login session.
- If no user exists for the normalized phone, successful OTP verification must return a pending signup state rather than creating a user immediately.
- If a user exists for the phone but `phoneVerified = false`, login must fail closed or require profile verification flow before login.
- Suspended users must remain blocked by existing auth boundary behavior.
- Phone login must not bypass existing role/admin guards.

## Phone Signup Contract

- Phone signup must verify the phone by OTP before creating a user.
- If the verified phone has no existing user, complete signup requires:
  - email
  - name
  - password
- Complete signup must create a user with:
  - normalized phone
  - `phoneVerified = true`
  - `role = USER`
  - `status = ACTIVE`
- Complete signup must not create phone-only users.
- Complete signup must not create users with placeholder email.
- Email uniqueness and password policy must be enforced.
- Email verification behavior must remain consistent with Auth v1.

## Profile Phone Linking Contract

- Logged-in users may request OTP for a new phone from profile.
- Phone link verification requires:
  - active authenticated session
  - matching phone challenge
  - purpose `PHONE_LINK`
  - unexpired and unconsumed OTP
- Successful phone link must:
  - normalize and store `User.phone`
  - set `User.phoneVerified = true`
  - consume the challenge
- A phone already linked to another user must be rejected.
- Updating phone through normal profile update must not set `phoneVerified = true` unless the OTP link flow succeeds.

## API Contract

- Add first-party phone auth endpoints adjacent to existing auth/user modules.
- Endpoint set should cover:
  - request phone login/signup OTP
  - verify phone login/signup OTP
  - complete phone signup
  - request profile phone link OTP
  - verify profile phone link OTP
- API validation must use TypeBox / Prismabox patterns.
- Responses must not expose OTP values, OTP hashes, provider internals, or sensitive auth details.
- Public phone auth endpoints must avoid user enumeration where practical.
- Frontend requests must use same-origin `/api/*`.

## Frontend Contract

- Add phone auth entry points to auth UI.
- Phone login/signup UX must support:
  - enter phone
  - request OTP
  - enter OTP
  - existing verified phone login success
  - new phone complete signup with email/name/password
- Profile UX must support:
  - enter new phone
  - request OTP
  - enter OTP
  - verified linked phone state
- Forms must show clear loading, success, error, cooldown, and retry states.
- Forms must preserve user-entered data after mutation failures where practical.
- Do not add phone-only signup without email/password.

## Role Permission Contract

- Role permission scope remains unchanged.
- Keep platform roles limited to:
  - `USER`
  - `ADMIN`
- Do not add RBAC tables or admin permission matrix in this milestone.
- Phone auth must not bypass existing `withAuth`, `withVerifiedAuth`, or `withRole` behavior.

## Verification Contract

- Backend tests must cover:
  - challenge creation
  - phone normalization
  - OTP hash verification
  - expiry
  - consumption
  - max attempts
  - resend cooldown
  - request rate cap
  - verified phone login
  - new phone pending signup
  - complete phone signup
  - duplicate phone rejection
  - profile phone linking
- Frontend tests should cover:
  - phone auth form states
  - OTP success/failure states
  - pending signup transition
  - profile phone link states
- Verification commands:
  - `bun run db:generate`
  - `bunx tsc --noEmit`
  - focused auth/user/frontend tests affected by phone auth
