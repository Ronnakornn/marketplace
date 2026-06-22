# Task 1: Audit Buyer-Facing Blue/Teal Readability

## Objective

Identify buyer-facing text and icon classes that use light blue/teal or faint inactive colors on white or pale mobile surfaces.

## Scope

- Inspect:
  - `app/components/BuyerShell.tsx`
  - `app/features/marketplace/components/MarketplaceHome.tsx`
  - `app/styles.css` buyer-facing color tokens
- Exclude:
  - `app/features/admin/**`
  - `app/[locale]/admin/**`
  - `.admin-galaxy` styles

## Deliverable

A concise list of exact class/token changes needed for task 2.

## Verification

Confirm the audit does not recommend admin-only cyan styling changes.
