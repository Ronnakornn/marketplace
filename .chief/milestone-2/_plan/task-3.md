# task-3: Integrate Auth v1 frontend flows for verification, password reset/change, and profile phone updates

## Objective

Expose the Auth v1 backend capabilities through focused Next.js App Router pages and auth/profile feature UI.

## Scope

- Extend existing auth feature UI for:
  - verification required state
  - resend verification OTP
  - verify email OTP
  - forgot password
  - reset password
  - change password
- Extend current profile UI to support phone updates.
- Keep login/signup flows on Better Auth client helpers where appropriate.
- Use same-origin `/api/*` for first-party backend calls.

## Constraints

- Do not implement phone login.
- Do not implement phone verification UI.
- Do not implement social login UI.
- Do not manually duplicate backend DTOs in frontend code.
- Failed mutations should preserve user-entered form data where practical.

## Implementation Notes

- Keep auth feature code under `app/features/auth/`.
- Keep profile/user feature code under the existing user/admin profile structure where appropriate.
- Verification-required UX should give users a clear path to resend and submit OTP.
- Reset password UX should avoid revealing whether an email exists.
- Use existing project UI patterns and keep forms accessible with labels, visible errors, and usable loading states.

## Verification

- Add focused frontend tests where practical for:
  - verification required state
  - OTP submission errors
  - password reset/change form validation
  - phone profile update error handling
- Verify desktop and mobile layouts for new auth/profile screens if UI changes are substantial.
