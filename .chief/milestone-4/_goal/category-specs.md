# Goal: Category Tree and Specs

## Outcome

Categories support hierarchy and category-specific product specs for filtering and publish readiness.

## Scope

- Add parent-child category support.
- Add category attribute/spec definitions for product forms and filtering.
- Keep one primary `Product.categoryId`.
- Do not implement product multi-category assignment in this milestone.

## Success Criteria

- Category APIs can return active category trees.
- Seller product forms can resolve required and optional specs for a category.
- Product specs can be used by catalog filters without duplicating schema definitions manually.
