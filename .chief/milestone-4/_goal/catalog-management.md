# Goal: Product Catalog Management

## Outcome

Sellers can create, edit, submit, and maintain products through a production-ready catalog workflow, while admins can inspect and moderate listings.

## Scope

- Support seller-owned product create/edit/list flows.
- Keep product business rules in catalog services and database access in repositories.
- Preserve existing public catalog APIs except for required response additions.
- Keep products assigned to one primary category.
- Do not implement multi-category listing in this milestone.

## Success Criteria

- Seller product APIs enforce shop ownership through existing auth and active shop rules.
- Product publish readiness validates category, media, active variant, price, and required specs.
- Product changes invalidate relevant catalog/search caches.
- Existing buyer catalog behavior remains compatible.
