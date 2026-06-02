# task-6: Configure Better Auth Google/Facebook providers and safe provider availability

## Objective

Enable Google and Facebook provider configuration through Better Auth while exposing only safe provider availability to frontend code.

## Scope

- Configure Better Auth social providers for:
  - Google
  - Facebook
- Read provider credentials from server environment variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `FACEBOOK_CLIENT_ID`
  - `FACEBOOK_CLIENT_SECRET`
- Ensure incomplete provider credentials disable that provider without breaking email/password auth.
- Add a safe provider availability mechanism for frontend use when needed.

## Constraints

- Do not expose provider secrets to frontend responses or client bundles.
- Do not hardcode development provider credentials.
- Do not implement custom OAuth callback handling if Better Auth can own the provider flow.
- Do not add providers beyond Google and Facebook.

## Implementation Notes

- Prefer centralizing provider availability checks near the auth configuration.
- If a first-party endpoint is added, it should return booleans only, such as `google` and `facebook`.
- Keep email/password auth available regardless of social provider configuration.
- Review Better Auth provider configuration requirements before implementation.

## Verification

- Add focused tests for provider availability with complete and incomplete env configuration where practical.
- Run affected auth tests.
- Run `bunx tsc --noEmit`.
