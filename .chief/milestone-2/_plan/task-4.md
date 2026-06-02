# task-4: Harden admin/user role boundaries and seed-admin operational behavior

## Objective

Make the existing `USER` / `ADMIN` authorization boundary safer without introducing new RBAC infrastructure.

## Scope

- Review admin routes and user-management routes for correct `withRole: 'ADMIN'` usage.
- Ensure admin-only behavior is inaccessible to:
  - unauthenticated users
  - unverified users
  - suspended users
  - non-admin users
- Review existing admin role mutation behavior.
- Preserve seed/admin tooling as the only intended operational admin assignment path for Auth v1.
- Prevent self-demotion or last-admin removal where practical.

## Constraints

- Do not add role/permission tables.
- Do not add admin invite flow.
- Do not add user-facing admin role request flow.
- Do not expose admin routes publicly.

## Implementation Notes

- Prefer hardening existing user/admin service methods over adding broad new abstractions.
- If last-admin protection needs repository support, keep the query small and explicit.
- Use `appContext.logger` for operational logging if role/status mutation behavior logs anything.

## Verification

- Add focused authorization tests for:
  - non-admin rejection
  - unverified admin rejection where verified identity is required
  - suspended admin rejection
  - self-demotion prevention
  - last-admin protection where implemented
