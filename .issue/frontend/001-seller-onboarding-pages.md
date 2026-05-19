# Frontend Issue 001: Seller Onboarding Pages

## Impact

Buyer accounts must be able to register a shop without switching account type. The seller UI needs onboarding and status pages before operational seller tools unlock.

## Tasks

- Build `/seller/register` multi-section form:
  - shop profile
  - business/legal KYC
  - pickup/return address
  - bank/payout
  - KYC document upload
  - review and submit
- Build `/seller/status` for draft, submitted, rejected, approved, and cancelled states.
- Persist draft state through `POST /api/seller/application/draft`.
- Submit through `POST /api/seller/application/submit`.
- Display backend validation errors clearly.

## Acceptance Criteria

- Authenticated buyer can start selling from header/profile.
- Rejected application shows reason and edit/resubmit action.
- Submitted application blocks seller operations but keeps buyer features available.
