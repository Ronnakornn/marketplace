# Goal: Review And Report Moderation

## Outcome

Admins can act on product reviews and review reports with traceable decisions.

## Scope

- Support review status transitions:
  - `PENDING -> PUBLISHED`
  - `PENDING -> REJECTED`
  - `PUBLISHED -> HIDDEN`
  - `HIDDEN/REJECTED -> PUBLISHED`
- Support review report status transitions:
  - `OPEN -> UNDER_REVIEW`
  - `OPEN/UNDER_REVIEW -> RESOLVED_REMOVED`
  - `OPEN/UNDER_REVIEW -> RESOLVED_DISMISSED`
- Require moderation notes for hide, reject, and report dismiss actions.
- Keep review author ownership and buyer review behavior unchanged.

## Success Criteria

- Hidden or rejected reviews are not returned by public product review APIs.
- Report resolution can optionally change the related review status when resolving as removed.
- Admin decisions are visible in admin UI state.
- Focused tests cover valid transitions and invalid transition rejection.
