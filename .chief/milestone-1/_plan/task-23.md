# task-23: Extend catalog schema for brand profiles, product facts, highlights, and filterable attributes

## Goal

Add the database foundation for complete brand profiles and enriched product data.

## Scope

- Extend `Brand` with buyer-ready profile fields:
  - localized name/description fields
  - description
  - logo URL
  - website URL
  - country/origin field
  - sort order
  - featured flag
- Extend `Product` with buyer-facing facts:
  - SEO title and description
  - warranty info
  - condition
  - country of origin
- Add product highlights as ordered bullet text.
- Add product attributes/specifications with normalized `attributeKey`, display/value fields, sort order, and `isFilterable`.
- Add indexes and uniqueness constraints needed for brand lookup and attribute filtering.

## Implementation Notes

- Use Prisma as source of truth. Do not edit generated files manually.
- Prefer dedicated models for highlights and product attributes unless implementation discovers a stronger reason.
- Keep schema names explicit and compatible with existing Prisma naming conventions.
- Product attribute uniqueness should prevent duplicate normalized keys per product where practical.
- Do not add category attribute template management in this task.
- Do not add seller-created brand approval fields/workflow.

## Verification

- Run `bunx prisma format`.
- Run `bunx prisma validate`.
- Run `bun run db:generate`.
- Run focused schema/type checks required by generated code fallout.
- Record any migration/generation constraints if local DB migration cannot run.
