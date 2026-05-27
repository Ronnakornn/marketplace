# Shop Profile and Multi-Shop Management Contract

## Ownership and Access Contract

- Seller profile/shop management endpoints use `{ withAuth: true }` plus active owned shop resolution.
- Seller must only read/update shops they own.
- Cross-shop access must return authorization errors and must not leak resource existence.
- Shop status constraints remain in force:
  - operational seller mutations require active shop context
  - non-active shops have restricted behavior based on existing seller rules
- Buyer-only users who have not reached active-shop readiness must be denied seller operational endpoints and redirected to onboarding/status flows at UI layer.

## API Contract

- Existing shop-related read paths may be extended where overlap exists.
- New seller shop-management endpoints may be added for clear responsibility boundaries, such as:
  - shop profile read/update
  - shop settings read/update
  - owned shop list for context switching
- Any new endpoint must remain under existing module boundaries and preserve API-first compatibility.
- Existing endpoint shapes remain backward compatible for current consumers.

## Data Contract

- Shop profile management may update only seller-managed fields, such as:
  - name, slug (if allowed by business rules)
  - contactEmail, contactPhone
  - description
  - logoUrl, coverUrl
  - selected settings fields through ShopSetting
- Seller must not mutate admin-only moderation fields (approval metadata, suspension/rejection control, admin decision fields).
- Slug uniqueness and core data integrity remain enforced at backend layer.

## Multi-Shop Contract

- Multi-shop users can list/select owned shops up to existing `SellerProfile.maxShopCount` constraints.
- Seller query keys and mutation invalidation must include active shop context to prevent data bleed.
- Shop selector behavior must not assume single-shop ownership.
- Cache keys must include shop scope for seller data.

## Localization and UX Contract

- Seller-facing shop profile management states support Thai and English user-facing text.
- UI states must include loading, empty, success, and actionable error/retry behavior.

## Verification Contract

- Add focused tests for owner-only shop profile updates and forbidden cross-shop attempts.
- Add focused tests for multi-shop context switching and shop-scoped query/mutation behavior.
- Add focused tests for slug/contact validation and protected admin-only field boundaries.
- Run `bunx tsc --noEmit`.
