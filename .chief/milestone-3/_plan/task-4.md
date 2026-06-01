# task-4: Integrate phone auth and profile phone linking frontend flows

## Objective

Add user-facing phone auth flows to login/signup and profile while preserving existing email and social auth flows.

## Scope

- Add phone auth entry point to auth UI.
- Build phone login/signup flow:
  - enter phone
  - request OTP
  - enter OTP
  - existing verified phone login success
  - new verified phone complete signup with email/name/password
- Build profile phone linking flow:
  - enter new phone
  - request OTP
  - enter OTP
  - show linked/verified phone state
- Preserve email/password and Google/Facebook login/signup UI.

## Constraints

- Do not add phone-only signup.
- Do not add production SMS vendor configuration UI.
- Do not add RBAC/admin permission UI.
- Do not manually duplicate backend DTOs beyond existing local API helper patterns.

## Implementation Notes

- Keep auth UI under `app/features/auth/` where practical.
- Keep profile phone linking in the existing profile/user feature area.
- Forms must show loading, error, success, cooldown, retry, and disabled states.
- Preserve user-entered data after mutation failures where practical.
- Keep controls accessible with labels and clear button names.

## Verification

- Add focused frontend tests for:
  - phone OTP request form
  - OTP verification errors
  - pending signup transition
  - complete signup validation
  - profile phone link states
- Run affected frontend tests.
- Run `bunx tsc --noEmit`.
