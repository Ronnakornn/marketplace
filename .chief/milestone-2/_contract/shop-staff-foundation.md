# Shop Staff Management Foundation Contract

## Capability Contract

- Optional staff scope in this milestone must still be end-to-end coherent for owner-managed delegation.
- Foundation capabilities include:
  - invite existing platform user to owned shop
  - list staff members for owned shop
  - update staff role/status under allowed transitions
  - remove/deactivate staff membership
- External email-token invites for non-existing users are out of scope.

## Authorization Contract

- Staff management routes use `{ withAuth: true }` plus owner authorization.
- Only shop owner (or explicitly authorized equivalent, if approved later) can manage shop staff.
- Staff permissions apply only within assigned shop scope.
- Cross-shop privilege escalation must be prevented by backend checks.

## Data Contract

- Reuse existing `ShopStaff` and `ShopStaffPermission` models.
- Staff lifecycle must align with existing status model (invited/joined/etc.) and soft-delete behavior where present.
- Permission presets should map to allowed seller operations without introducing full custom policy graph in this milestone.
- Unique staff membership per shop-user pair remains enforced.

## API Contract

- New shop-staff endpoints may be introduced under seller/shop management surfaces.
- Endpoint contracts should include explicit shop scope input and enforce owned-shop checks.
- Response contracts should include enough data for management UI (identity, role, status, joined/invited metadata, effective preset permissions).
- Existing seller auth model remains unchanged (no platform `SELLER` role requirement).

## Multi-Shop Contract

- Staff assignment is shop-specific; same user may hold different role/status across different shops.
- Staff checks used by seller operations must include selected shop context.

## Audit and Safety Contract

- Staff role/status changes should be traceable through existing logging/audit patterns where applicable.
- Sensitive internal identifiers must not be overexposed in public contexts.

## Verification Contract

- Add focused tests for owner-only staff invite/update/remove actions.
- Add focused tests for staff isolation across shops and membership uniqueness.
- Add focused tests for permission preset enforcement on at least one seller operation boundary.
- Run `bunx tsc --noEmit`.
