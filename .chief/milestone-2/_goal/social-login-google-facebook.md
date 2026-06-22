# Social Login Google/Facebook Goal

## Objective

Extend Auth v1 with Google and Facebook login while preserving the existing verified-email identity boundary, Better Auth foundation, and `USER` / `ADMIN` authorization rules.

## Scope

- Add Google social login.
- Add Facebook social login.
- Use Better Auth social provider support rather than building custom OAuth handling.
- Add social login entry points to login and signup pages.
- Configure providers through server-side environment variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `FACEBOOK_CLIENT_ID`
  - `FACEBOOK_CLIENT_SECRET`
- Expose only provider availability to the frontend; never expose provider secrets.
- Hide or disable provider buttons when the corresponding provider config is incomplete.
- Preserve existing `next` redirect behavior after login with same-origin relative-path validation.
- Auto-link social accounts to existing users only when the provider supplies a trusted verified email matching the existing user email.
- Reject social login when provider email is missing or not verified.
- Mark local `emailVerified` true when a trusted provider verified email is accepted.

## Success Criteria

- Users can start Google login from login and signup pages when Google config is complete.
- Users can start Facebook login from login and signup pages when Facebook config is complete.
- Social login creates a local user only when the provider returns a verified email.
- Social login links to an existing local user only when the provider returns a verified email matching that user.
- Social login never creates a user without an email.
- Social login never auto-links an unverified provider email to an existing user.
- Successful social login returns users to the validated `next` path when present, otherwise to the default app destination.
- Provider buttons do not appear as usable actions when provider config is incomplete.
- Existing email/password login, email verification, password reset, profile phone, and admin guard behavior continue to work.

## Out of Scope

- Profile UI for linking or unlinking providers.
- Manual account linking flow after login.
- Social provider token management UI.
- Additional providers beyond Google and Facebook.
- Phone login or phone verification.
- Real Google/Facebook browser E2E tests with external sandbox accounts.
- RBAC role/permission expansion.

## Verification Goal

- Add focused backend tests for social provider configuration and trusted email handling where practical.
- Add focused frontend/component tests for provider button visibility and social login action behavior.
- Add tests for redirect sanitization around social login callback paths where practical.
- Mock provider behavior in local automated tests; do not require real Google/Facebook credentials for deterministic verification.
- Run `bunx tsc --noEmit`.
- Run focused auth/frontend tests affected by social login changes.
