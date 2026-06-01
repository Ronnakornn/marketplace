# task-1: Add PhoneOtpChallenge schema and phone OTP provider foundation

## Objective

Create the database and provider abstraction foundation needed for phone OTP flows.

## Scope

- Add `PhoneOtpChallenge` to `prisma/schema.prisma`.
- Add purpose enum or equivalent schema representation for:
  - `PHONE_LOGIN`
  - `PHONE_SIGNUP`
  - `PHONE_LINK`
- Include fields required by the contract:
  - normalized phone
  - OTP hash/verifier
  - attempts/max attempts
  - resend availability
  - expiry
  - consumed/revoked state
  - timestamps
- Add indexes for phone lookup, purpose lookup, expiry cleanup, and active challenge checks.
- Add an OTP provider abstraction with a deterministic dev/mock provider.
- Keep production SMS adapter out of scope.

## Constraints

- Do not store raw OTP plaintext.
- Do not manually edit generated files.
- Do not bind to Twilio/AWS SNS/other SMS vendor.
- Do not change role/RBAC schema.

## Implementation Notes

- Keep provider code under the auth module or a small auth-adjacent lib, whichever matches existing patterns.
- The dev/mock provider should be deterministic enough for tests while not encouraging production plaintext OTP logging.
- Keep constants explicit for OTP length, expiry, cooldown, and max attempts if introduced here.

## Verification

- Run Prisma format/validate where applicable.
- Run `bun run db:generate`.
- Run `bunx tsc --noEmit`.
- Add focused tests for provider abstraction if practical.
