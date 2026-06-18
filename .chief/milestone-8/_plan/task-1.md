# Task 1: Spec Validation Helpers

## Goal

Add catalog service helpers that validate submitted product attributes against active category spec definitions.

## Affected Areas

- `server/modules/catalog/catalog.service.ts`
- `server/modules/catalog/catalog.service.test.ts`

## Required Work

1. Add helper logic to load active specs for a product category.
2. Normalize submitted `attributeKey` values using the existing attribute-key rules.
3. Detect duplicate submitted attribute keys.
4. Validate required active specs are present when the product has a category.
5. Validate type-level values:
   - `TEXT`: non-empty when required.
   - `NUMBER`: finite number, persisted as normalized string.
   - `BOOLEAN`: accept `true`, `false`, `yes`, `no`, `1`, `0`; persist `true` or `false`.
   - `SELECT`: non-empty.
   - `MULTI_SELECT`: comma-separated non-empty values, persisted normalized.
6. Reject submitted attributes that target inactive category specs or specs outside the selected category.
7. Keep free-form attributes allowed when they do not collide with category spec keys.

## Out of Scope

- Enum option validation.
- Range/min/max validation.
- Regex validation.
- Unit conversion.
- Product attribute migration.

## Acceptance Criteria

- Helper returns normalized attributes ready for repository persistence.
- Helper throws stable service errors for missing required, invalid type, invalid spec key, and duplicates.
- Focused service tests cover each spec type and duplicate/wrong-spec cases.

## Verification

```bash
bunx vitest run server/modules/catalog/catalog.service.test.ts
```
