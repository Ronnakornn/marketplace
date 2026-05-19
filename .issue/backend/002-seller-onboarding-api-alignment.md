# Backend Issue 002: Seller Onboarding API Alignment

## Impact

Seller onboarding must match the current schema fields, including `SellerProfile`, `SellerApplication`, shop contact fields, application status, KYC data, and admin review metadata.

## Tasks

- Align `GET /api/seller/application` response with current `SellerApplication` and `Shop` fields.
- Align draft/submit input with `shopContactEmail`, `shopContactPhone`, `sellerProfileId`, KYC fields, pickup address, and documents.
- Ensure submit creates or updates pending `Shop` and related `SellerProfile` state consistently.
- Ensure approve transaction updates application, seller profile verification, shop status, wallet/settings/address defaults, audit log, and shop activity log.
- Ensure reject stores `rejectionReason` and keeps shop operations locked.
- Add support for `CANCELLED` application status if it remains in schema.

## Acceptance Criteria

- Buyer accounts can save draft and submit applications.
- Admin approval activates seller operations without changing `User.role`.
- Admin rejection gives a reason and permits resubmission.
