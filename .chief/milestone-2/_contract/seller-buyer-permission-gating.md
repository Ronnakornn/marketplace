# Seller and Buyer Permission Gating Contract

## Scope Contract

- Permission gating must be enforced at two layers:
  - frontend seller route guard (navigation/redirect behavior)
  - backend seller operational API authorization (request-time enforcement)
- Gating applies to buyer-to-seller conversion journey and seller operational access readiness.

## Route Access Contract

- Route policy by onboarding/activation state:
  - no application or `DRAFT`: `/seller/register`
  - `SUBMITTED`: `/seller/status` only
  - `APPROVED` without active shop: `/seller/status` only
  - `REJECTED` or `CANCELLED`: direct `/seller/register` allowed for correction/resubmit
  - active owned shop available: seller operational routes allowed
- Frontend guard decisions must be deterministic and computed from authenticated user seller access state.

## API Enforcement Contract

- Seller operational APIs must reject access when seller readiness is not satisfied.
- Initial endpoint scope in this milestone includes:
  - `/api/seller/dashboard*`
  - `/api/seller/shops*`
  - `/api/seller/wallet*`
  - `/api/seller/shipments*` (where present)
  - seller product-management endpoints under `/api/seller/*`
- Explicit onboarding exceptions (must stay reachable for buyer conversion):
  - `/api/seller/application`
  - `/api/seller/application/draft`
  - `/api/seller/application/submit`
  - seller status-read endpoints used for onboarding progression

## Error Contract

- Introduce centralized seller-readiness rejection codes for operational APIs:
  - `SELLER_ONBOARDING_REQUIRED`
  - `SELLER_SHOP_INACTIVE`
- Error payload must include deterministic redirect hint metadata (`redirectPath`) pointing to:
  - `/seller/register` when onboarding input is required
  - `/seller/status` when waiting for review/activation
- Error contract should remain additive and not break existing consumers.

## Authorization Contract

- Do not introduce platform `SELLER` role dependency.
- Enforcement remains identity + ownership + active-shop status based.
- Multi-shop behavior must remain shop-scoped and must not leak non-owned shop resources.

## UX Alignment Contract

- Frontend route guard and backend API rejection semantics must stay aligned for each onboarding/activation state.
- Flow follows Shopee-like staged activation behavior as reference only; implementation remains original and project-specific.

## Verification Contract

- Add focused tests for frontend guard transitions by onboarding status and active-shop state.
- Add focused backend tests for operational API allow/deny behavior with `SELLER_ONBOARDING_REQUIRED` and `SELLER_SHOP_INACTIVE` codes.
- Add focused tests ensuring onboarding endpoints are reachable by buyer users in allowed states.
- Add focused tests validating `redirectPath` metadata in rejection payloads.
- Run `bunx tsc --noEmit`.
