# Goal: Category Spec Admin Mutations

## Outcome

Admins can manage category-specific spec definitions that drive seller product readiness and buyer filtering.

## Scope

- Admin-only spec definition management.
- Manage `attributeKey`, `displayName`, `displayNameTh`, `displayNameEn`, `type`, `isRequired`, `isFilterable`, `unit`, `sortOrder`, and `isActive`.
- Add, update, deactivate, reactivate, and reorder specs within one category.
- Enforce unique `attributeKey` per category.
- Keep required active specs enforced during product submit-for-review.

## Out of Scope

- Complex validation rules such as min/max, regex, enum option constraints, or unit conversion.
- Seller requests for new specs.
- Automatic migration of existing product attribute values.

## Success Criteria

- Admin APIs persist spec changes and return updated category spec state.
- Seller product forms receive active required/filterable specs for selected active categories.
- Deactivated specs stop appearing in seller/public spec lists without deleting historical product attributes.
- Required active specs continue blocking product review submission when missing.
- Spec mutations invalidate affected category/product discovery caches where applicable.
