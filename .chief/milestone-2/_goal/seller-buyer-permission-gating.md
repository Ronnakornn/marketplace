# Seller and Buyer Permission Gating Goal

## Objective

Establish a consistent permission-gating model so buyer users can onboard to become sellers step-by-step while seller operational surfaces remain protected until active-shop readiness is achieved.

## Scope

- Enforce permission gating at two layers:
  - frontend seller route guard behavior
  - backend seller operational API authorization checks
- Apply staged route access rules aligned with onboarding state:
  - no application or draft: `/seller/register`
  - submitted: `/seller/status` only
  - approved without active shop: `/seller/status` only
  - rejected or cancelled: direct `/seller/register` access for correction/resubmit
  - active shop ready: seller operational routes available
- Apply API gate to seller operational endpoints while keeping onboarding endpoints reachable for buyer-to-seller conversion.
- Use Shopee-style behavior as a product reference for staged activation flow (behavioral reference only, not 1:1 cloning).

## Success Criteria

- Buyer users can access seller onboarding flow without being granted seller operational access prematurely.
- Seller operational routes and APIs are consistently blocked until active owned shop requirements are met.
- Redirect and rejection outcomes are deterministic and status-driven across both frontend and backend.
- Gating logic remains ownership-safe and compatible with multi-shop context.

## Out of Scope

- Introducing a platform-level `SELLER` role.
- Replacing current onboarding lifecycle states.
- Full external policy engine or ABAC framework rollout.

## Verification Goal

- Add focused tests for seller route guard transitions across onboarding statuses.
- Add focused tests for backend seller operational endpoint rejection/allow rules by onboarding and active-shop state.
- Add focused tests ensuring onboarding endpoints remain available to buyer users in allowed statuses.
- Run `bunx tsc --noEmit`.
