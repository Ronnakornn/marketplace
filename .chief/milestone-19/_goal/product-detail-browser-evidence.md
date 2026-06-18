# Product Detail Browser Evidence

## Goal

Restore reliable browser verification for buyer product detail UX work.

## In Scope

- Desktop product detail screenshot for a seeded/known active product.
- Mobile product detail screenshot for the same product.
- Logged-in buyer product detail screenshot showing buyer-visible state.
- Evidence saved under `.chief/milestone-19/_report/`.

## Out of Scope

- Cross-browser certification.
- Payment provider validation.
- Purchase handoff browser regression unless route changes affect purchase behavior.

## Constraints

- Browser verification must use same-origin frontend routes.
- If seed data is unavailable, document the exact API/route state and blocker.
- Stop local dev processes started for evidence after verification.
