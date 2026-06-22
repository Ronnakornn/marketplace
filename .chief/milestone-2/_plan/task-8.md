# task-8: Add Google/Facebook login UI to login and signup flows

## Objective

Add accessible Google and Facebook login actions to the existing login and signup user experience.

## Scope

- Add social login buttons to:
  - login page
  - signup page
- Start Better Auth social sign-in for the selected provider.
- Preserve sanitized `next` redirect behavior after successful social login.
- Hide or disable provider actions when provider availability is false.
- Keep email/password forms available and unchanged except for social entry additions.

## Constraints

- Do not add profile link/unlink management.
- Do not add phone login or phone verification UI.
- Do not add social providers beyond Google and Facebook.
- Do not manually duplicate backend response DTOs.

## Implementation Notes

- Keep code under the existing auth feature where practical.
- Use existing project visual patterns.
- Buttons must have accessible names and usable loading/disabled states.
- Provider availability may come from a first-party endpoint or server-rendered data, depending on the implementation chosen in task-6.
- Error states should not expose sensitive provider internals.

## Verification

- Add focused component tests for:
  - social buttons visible when providers are available
  - provider action starts social sign-in
  - buttons hidden/disabled when providers are unavailable
  - sanitized `next` is used
- Run affected frontend tests.
- Run `bunx tsc --noEmit`.
