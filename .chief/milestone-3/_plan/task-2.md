# task-2: Implement phone OTP service, security controls, and backend APIs

## Objective

Implement reusable backend phone OTP challenge behavior with abuse controls and first-party API endpoints.

## Scope

- Add repository/service logic for phone OTP challenges.
- Implement:
  - phone normalization
  - challenge creation
  - OTP hashing/verification
  - expiry enforcement
  - consumed/revoked challenge rejection
  - max attempts
  - resend cooldown
  - request rate cap per phone
- Add API endpoints for:
  - request phone login/signup OTP
  - verify phone login/signup OTP
  - request profile phone link OTP
  - verify profile phone link OTP
- Use TypeBox / Prismabox validation patterns.

## Constraints

- Do not complete signup or create login sessions in this task unless needed for API shape; task-3 owns session/account completion flows.
- Do not expose OTP values or hashes in responses.
- Public phone auth endpoints should avoid user enumeration where practical.
- Do not add phone-only users.

## Implementation Notes

- Keep business rules in services and database access in repositories.
- Return explicit state for verified phone that can proceed to login or signup without leaking unnecessary account existence details.
- For profile phone link endpoints, require authenticated session.
- Consume challenges only when the corresponding verification succeeds.

## Verification

- Add backend tests for:
  - challenge creation
  - normalization
  - hash verification
  - expiry
  - consumption
  - max attempts
  - resend cooldown
  - request rate cap
  - duplicate phone link rejection where applicable
- Run focused auth/user tests.
- Run `bunx tsc --noEmit`.
