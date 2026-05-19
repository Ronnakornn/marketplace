# Backend Issue 006: Backend Tests And Contracts

## Impact

The seller model change affects authorization, onboarding, upload, return, wallet, payout, chat, admin review, and buyer flows.

## Tasks

- Add seller onboarding service tests for draft, submit, approve, reject, slug collision, required documents, upload ownership, and resubmit.
- Add authorization tests for no shop, pending shop, active owner, suspended shop, cross-shop, and admin access.
- Add buyer flow tests showing active shop owner can still cart/checkout/order/review/return/chat.
- Add upload tests for KYC document and review video usage.
- Update API contract tests and generated Eden/TypeBox types.

## Acceptance Criteria

- `bunx tsc --noEmit` passes.
- Relevant seller onboarding, upload, auth, buyer, and admin tests pass.
- Tests fail if `SELLER` role authorization is reintroduced.
