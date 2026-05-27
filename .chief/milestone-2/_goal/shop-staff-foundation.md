# Shop Staff Management Foundation Goal

## Objective

Provide optional but production-usable staff management foundations so shop owners can delegate limited operations safely.

## Scope

- Implement staff foundation capabilities for owned shops:
  - invite an existing platform user to a shop
  - list staff members
  - update staff role/status within allowed rules
  - remove or deactivate staff membership where applicable
- Start with permission presets/foundation, not full fine-grained enterprise RBAC.
- Keep all staff operations scoped to shop ownership and active operational rules.
- Maintain compatibility with current auth model where seller capability is not tied to a dedicated `SELLER` platform role.

## Success Criteria

- Shop owner can invite existing users and manage staff lifecycle states safely.
- Staff records remain isolated per shop with no cross-shop privilege bleed.
- Staff capability checks can be used by seller operational routes introduced later.
- Optional scope is implemented as a minimal but coherent foundation, not partial dead-end stubs.

## Out of Scope

- Email-based external invite token flows for users without accounts.
- Full policy engine with arbitrary custom permission graphs.
- Organization-level multi-shop enterprise hierarchy management.

## Verification Goal

- Add focused tests for owner-only staff management actions and status transitions.
- Add focused tests for permission preset enforcement and cross-shop isolation.
- Run `bunx tsc --noEmit`.
