# task-1: Extend auth schema and generated contracts for phone identity and verification state

## Objective

Add the schema foundation Auth v1 needs for normalized phone identity while preserving Better Auth compatibility.

## Scope

- Update `prisma/schema.prisma` only through Prisma-managed schema changes.
- Extend `User` with:
  - nullable `phone`
  - `phoneVerified` defaulting to false
- Add a uniqueness constraint for `phone` when present using the best Prisma/PostgreSQL-compatible approach available in the project.
- Ensure generated Prisma and Prismabox outputs can represent the new fields.
- Review Better Auth user additional fields so auth session/user context can safely expose only intended profile fields.

## Constraints

- Do not make phone login available.
- Do not make phone verification available.
- Do not allow `phoneVerified` to be writable by user profile update payloads.
- Do not manually edit generated files.

## Implementation Notes

- Use an E.164-compatible normalized phone representation for persistence.
- Keep `phone` nullable so existing users do not need backfilled phone data.
- If Prisma cannot express partial uniqueness directly in the current setup, document the chosen migration/index approach before implementation.

## Verification

- Run `bun run db:generate`.
- Run Prisma validation/format commands used by the repo where applicable.
- Add or update focused schema-adjacent tests if existing test helpers cover generated user schemas.
