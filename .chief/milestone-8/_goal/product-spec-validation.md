# Goal: Product Spec Validation

## Outcome

Seller product attributes follow the active category spec definitions before a product can be created, updated, or submitted for review.

## Scope

- Validate product attributes against active specs for the selected product category.
- Enforce active required specs during seller create/update and submit-for-review flows.
- Validate supported spec value types:
  - `TEXT`: required values must be non-empty.
  - `NUMBER`: values must parse as finite numbers.
  - `BOOLEAN`: values normalize to `true` or `false`.
  - `SELECT`: values must be non-empty; option lists remain out of scope.
  - `MULTI_SELECT`: values must contain at least one non-empty item; option lists remain out of scope.
- Reject attributes that target inactive specs or specs outside the product category.
- Preserve historical attributes when specs are later deactivated.

## Out of Scope

- Enum option list management.
- Min/max range validation.
- Regex validation.
- Unit conversion.
- Automatic migration of existing product attributes.

## Success Criteria

- Invalid spec values are rejected by backend service validation with clear error codes.
- Active required specs block product create/update/review readiness when missing.
- Inactive specs do not block review readiness and cannot be newly submitted as active category attributes.
- Validation is covered by focused catalog service tests.
