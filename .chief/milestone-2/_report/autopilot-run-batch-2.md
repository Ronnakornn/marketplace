# Autopilot Run Batch 2

## Mode

auto

## Summary

Completed the Google/Facebook social login extension for Auth v1. The batch configured Better Auth providers, added safe provider availability, enforced verified-email-only social account creation/linking, added redirect safeguards, wired login/signup social buttons, and completed focused verification.

## Tasks Completed

- task-6: Configured Better Auth Google/Facebook providers and safe provider availability.
- task-7: Implemented trusted social email handling, account linking, and redirect safeguards.
- task-8: Added Google/Facebook login UI to login and signup flows.
- task-9: Verified social login extension with focused tests, typecheck, and documentation checks.

## Decisions Made (auto mode only)

- **Issue:** Provider availability needed to reach client UI without leaking secrets.
  **Options:** expose public env/client IDs, add a first-party boolean endpoint, or always render buttons.
  **Chosen:** add `/api/auth/provider-availability` returning booleans only.
  **Reason:** This satisfies frontend availability needs while keeping provider secrets server-only and hiding unusable actions.

- **Issue:** Social account linking needed a conservative trust boundary.
  **Options:** trust any matching provider email, require explicitly verified provider email, or require manual linking.
  **Chosen:** require explicitly verified provider email and matching local email; fail closed otherwise.
  **Reason:** Auth v1 depends on verified email as the identity boundary, and manual link/unlink is out of scope.

- **Issue:** Automated verification could not use real Google/Facebook OAuth apps.
  **Options:** require real provider E2E, use mocked deterministic tests, or rely on manual checklist only.
  **Chosen:** use focused mocked/unit/component tests and document real OAuth validation as residual rollout risk.
  **Reason:** Local CI should not depend on external credentials or provider callback availability.

## Backlog

- Real Google/Facebook OAuth callback validation in staging/production provider consoles.
- Profile provider link/unlink management remains out of scope.
- Additional social providers remain out of scope.
- Phone login and phone verification remain out of scope.

## User Action Needed

- Configure real Google/Facebook OAuth apps and callback URLs before production rollout.
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, and `FACEBOOK_CLIENT_SECRET` in the target environment.
- Manually validate real provider callbacks in staging with configured OAuth apps.
