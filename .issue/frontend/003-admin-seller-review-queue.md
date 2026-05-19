# Frontend Issue 003: Admin Seller Review Queue

## Impact

Admin shop management must include seller application review and KYC summaries.

## Tasks

- Add submitted seller application queue under admin shops or dedicated admin seller applications page.
- Show applicant, shop profile, legal/business type, masked identifiers, pickup address, payout summary, and document metadata.
- Add approve and reject actions.
- Require rejection reason.
- Invalidate admin shop/application queries after review.
- Add empty, loading, error, and success states.

## Acceptance Criteria

- Admin can approve a submitted application and see shop become active.
- Admin can reject with a reason and user sees that reason in `/seller/status`.
- KYC identifiers are masked in UI.
