# task-1: Align seller and shop schema contracts

## Goal

Align existing seller and shop schema usage with milestone-2 contracts for onboarding, profile management, shop reviews, dashboard insights, and staff foundation before feature implementation starts.

## Scope

- Review current Prisma models and enums used by:
  - SellerApplication and SellerProfile
  - Shop and ShopSetting
  - ShopRating and related review moderation models
  - ShopStaff and ShopStaffPermission
- Add or adjust schema fields and indexes only where milestone-2 contracts require them.
- Keep backward compatibility for existing modules that already use these models.
- Regenerate Prisma client and prismabox outputs after schema changes.

## Affected Areas

- `prisma/schema.prisma`
- `generated/client/**` (regenerated)
- `generated/prismabox/**` (regenerated)
- docs if schema-level behavior contract needs explicit update

## Implementation Notes

- Follow implementation order from AGENTS.md: schema first.
- Do not manually edit generated files.
- Preserve existing review/product domain behavior while extending shop review usage.
- Keep migration changes minimal and targeted to milestone-2 requirements.
- Ensure model changes do not break existing milestone-1 seller/product functionality.

## Verification

- Run:
  - `bunx prisma format`
  - `bunx prisma validate`
  - `bun run db:generate`
  - `bunx tsc --noEmit`
- Add or update focused tests that cover schema-dependent invariants introduced by this task.
