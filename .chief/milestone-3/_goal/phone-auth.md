# Phone Auth Goal

## Objective

Add phone OTP verification, phone login, phone signup, and profile phone linking while preserving the existing email identity requirements, Better Auth foundation, and `USER` / `ADMIN` role model.

## Scope

- Add phone OTP challenge support backed by a dedicated `PhoneOtpChallenge` model.
- Add an OTP provider abstraction with a deterministic dev/mock provider.
- Do not bind the milestone to a production SMS vendor.
- Add phone login:
  - request OTP by phone
  - verify OTP
  - login existing users whose `phoneVerified` is true
- Add phone signup:
  - verify phone by OTP first
  - if no user exists for the verified phone, continue to complete signup
  - complete signup requires email, name, and password before creating the user
- Add profile phone linking for existing users:
  - user must be logged in
  - request OTP for a new phone
  - verify OTP before storing `phone` and setting `phoneVerified = true`
- Add minimum OTP abuse controls:
  - expiry
  - resend cooldown
  - max attempts per challenge
  - max requests per phone per time window
- Keep role permission scope unchanged:
  - `USER`
  - `ADMIN`

## Success Criteria

- Users can request a phone OTP for login/signup.
- Existing users with verified phone can log in with phone OTP.
- A new phone that passes OTP verification can proceed to complete signup.
- Phone complete signup creates a user only after collecting email, name, and password.
- Phone complete signup creates a verified phone identity and keeps the email verification rules consistent with Auth v1.
- Logged-in users can verify and link a new phone from profile.
- A phone number cannot be linked to multiple users.
- OTP challenges expire and cannot be reused after success.
- Wrong OTP attempts are capped.
- OTP resend and request frequency are limited.
- Dev/mock OTP provider is deterministic enough for local tests and development.
- No real SMS vendor credentials are required for local automated tests.
- Existing email/password login, Google/Facebook login, email verification, password reset, and admin guards continue to work.

## Out of Scope

- Production SMS provider adapter.
- CAPTCHA or advanced risk scoring.
- Device fingerprinting.
- Phone-only users without email.
- Phone signup without password.
- Social provider link/unlink management.
- RBAC or permission tables beyond `USER` / `ADMIN`.
- Admin UI for viewing OTP codes.

## Verification Goal

- Add backend tests for:
  - phone OTP request
  - resend cooldown
  - max request cap
  - max attempt cap
  - expiry
  - successful login for verified phone
  - complete signup for new verified phone
  - profile phone linking
  - duplicate phone rejection
- Add frontend tests where practical for:
  - phone login form states
  - phone signup completion flow
  - profile phone verification/linking flow
- Run Prisma generation after schema changes.
- Run `bunx tsc --noEmit`.
- Run focused auth/user/frontend tests affected by phone auth.
