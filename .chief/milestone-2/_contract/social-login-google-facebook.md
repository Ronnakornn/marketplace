# Social Login Google/Facebook Contract

## Provider Configuration Contract

- Google login is enabled only when both are configured:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- Facebook login is enabled only when both are configured:
  - `FACEBOOK_CLIENT_ID`
  - `FACEBOOK_CLIENT_SECRET`
- Provider secrets must remain server-only.
- Frontend code may consume provider availability only, not client secrets.
- If a provider is not fully configured, its login/signup button must not be presented as an active action.
- Missing provider configuration must not break email/password login.

## Better Auth Contract

- Social login must use Better Auth provider support.
- Do not implement custom OAuth callback parsing unless Better Auth cannot express a required contract rule.
- Better Auth remains mounted through the existing auth plugin.
- The existing `Account` model remains the provider account persistence mechanism.
- Social provider account records must not expose access tokens, refresh tokens, ID tokens, or scopes to frontend responses.

## Trusted Email Contract

- Social login may create a local user only when the provider supplies an email that is trusted as verified.
- Social login may auto-link to an existing local user only when:
  - the provider supplies an email
  - the provider email is trusted as verified
  - the provider email matches the existing local user email
- Social login must reject or fail closed when provider email is missing.
- Social login must reject or fail closed when provider email is present but not trusted as verified.
- Accepted social login with verified provider email may mark local `emailVerified` true.
- Social login must not create local users with placeholder emails.
- Social login must not create local users with unverified provider emails.

## Account Linking Contract

- Auto-linking by verified matching email is allowed.
- Profile link/unlink UI is out of scope.
- Manual link/unlink API is out of scope unless Better Auth requires a minimal endpoint for callback correctness.
- Existing email/password users with matching verified provider email may sign in through Google/Facebook and end up in the same local user account.
- If the provider email belongs to an existing suspended user, login must still be blocked by the existing auth guard/session rules.

## Redirect Contract

- Social login entry points may accept a `next` value.
- `next` must be sanitized before use:
  - must start with `/`
  - must not start with `//`
  - must not be an absolute URL
- Invalid `next` values must fall back to the default app destination.
- Social login success should redirect to the sanitized `next` path when present.
- Callback behavior must not introduce open redirect risk.

## Frontend Contract

- Add Google and Facebook login buttons to:
  - login page
  - signup page
- Buttons should use existing project UI styling patterns.
- Buttons must expose accessible names.
- Buttons must show loading/disabled state while social sign-in is starting.
- Provider buttons must be hidden or disabled when provider availability reports incomplete config.
- Email/password login and signup forms must remain available regardless of social provider config.

## API Contract

- Add a first-party provider availability endpoint only if the frontend cannot safely infer provider availability from existing server-rendered config.
- Any provider availability endpoint must return booleans only, such as:
  - `google: boolean`
  - `facebook: boolean`
- Do not return provider client IDs or secrets from first-party app endpoints unless Better Auth specifically requires a public provider client ID. Secrets must never be returned.
- API validation must follow existing TypeBox / Elysia patterns where custom endpoints are added.

## Environment Documentation Contract

- Document new environment variables in the appropriate repo documentation and examples where environment variables are already listed.
- Document that real OAuth callback validation requires provider console configuration outside local deterministic tests.

## Verification Contract

- Add focused tests for:
  - provider availability behavior when env vars are present/missing
  - social button visibility/action behavior
  - sanitized `next` redirect handling
  - trusted provider email handling where Better Auth hooks or wrappers are implemented locally
- Local automated tests must mock provider behavior and must not require real Google/Facebook credentials.
- Run:
  - `bunx tsc --noEmit`
  - focused auth/frontend tests affected by social login
- Real Google/Facebook OAuth callback testing is a manual/environment validation item, not a required local automated test.
