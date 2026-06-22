# Shop Profile and Multi-Shop Management Goal

## Objective

Enable sellers to manage shop profile data safely and support multi-shop operation basics needed for a multi-vendor marketplace.

## Scope

- Add seller-facing shop profile management for owned shops, including:
  - core shop identity fields
  - contact and descriptive fields
  - branding fields such as logo and cover URL
  - policy fields via existing shop settings where applicable
- Add multi-shop operational foundation:
  - owned-shop selection in seller surfaces
  - shop-scoped query and mutation behavior
  - guardrails that prevent cross-shop access
- Keep seller operational pages and APIs inaccessible to buyer-only users until seller onboarding requirements are satisfied and an active owned shop exists.
- Keep admin-owned shop moderation/status control separate from seller self-management.
- Ensure Thai and English user-facing strings are supported for shop profile surfaces in this milestone.

## Success Criteria

- Seller can view and update profile information for an owned shop only.
- Multi-shop owners can switch active shop context without leaking data across shops.
- Seller operations remain blocked for shops that are not active, consistent with existing business rules.
- Buyer users who have not reached active-shop state cannot access seller operational surfaces.
- Shop profile changes are reflected in seller and buyer-facing read paths where applicable.
- Existing ownership and active-shop checks remain enforced.

## Out of Scope

- Full storefront theme builder or advanced page customization.
- Cross-tenant admin impersonation workflows.
- Deep SEO refactor outside the shop profile fields already modeled.

## Verification Goal

- Add focused tests for shop ownership enforcement and shop-scoped updates.
- Add focused tests for multi-shop selection behavior and access isolation.
- Run `bunx tsc --noEmit`.
