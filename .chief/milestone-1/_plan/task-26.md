# task-26: Add bootstrap master seed and demo catalog seed coverage for enriched products

## Goal

Provide safe seed data paths for brand/category master data and realistic enriched demo products.

## Scope

- Add or update bootstrap master seed for:
  - categories
  - brands with profile fields
- Add or update local/dev demo catalog seed for:
  - demo shops/seller ownership where needed by existing seed patterns
  - products with brand assignments
  - variants
  - inventory
  - images
  - highlights/facts
  - product attributes/specifications
- Ensure seed data demonstrates buyer brand/spec display and filtering.

## Implementation Notes

- Keep bootstrap and demo seed paths clearly separated.
- Seed scripts must be non-destructive by default.
- Use upserts or stable identities where practical.
- Do not randomly overwrite real records.
- Make script names and package commands clear enough that demo seed is not mistaken for production bootstrap.
- Preserve existing seed behavior unless it conflicts with seed safety.

## Verification

- Add focused seed tests or dry-run verification where practical.
- Run seed scripts in a safe local/test mode if feasible.
- Run Prisma validation/generation if seed depends on generated types.
- Run `bunx tsc --noEmit`.
