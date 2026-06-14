# Contract: Moderation Transition Rules

## Review Transitions

Allowed:

- `PENDING -> PUBLISHED`
- `PENDING -> REJECTED`
- `PUBLISHED -> HIDDEN`
- `HIDDEN -> PUBLISHED`
- `REJECTED -> PUBLISHED`

Required note:

- `PENDING -> REJECTED`
- `PUBLISHED -> HIDDEN`

## Review Report Transitions

Allowed:

- `OPEN -> UNDER_REVIEW`
- `OPEN -> RESOLVED_REMOVED`
- `OPEN -> RESOLVED_DISMISSED`
- `UNDER_REVIEW -> RESOLVED_REMOVED`
- `UNDER_REVIEW -> RESOLVED_DISMISSED`

Required note:

- `RESOLVED_DISMISSED`

Side effect:

- `RESOLVED_REMOVED` may set the related review to `HIDDEN` when the report targets a product review.

## Product Question Transitions

Allowed:

- `PENDING -> PUBLISHED`
- `PENDING -> HIDDEN`
- `PUBLISHED -> HIDDEN`
- `HIDDEN -> PUBLISHED`
- `REJECTED -> PUBLISHED`

Required note:

- transitions to `HIDDEN`

## Product Answer Transitions

Allowed:

- `PENDING -> PUBLISHED`
- `PENDING -> HIDDEN`
- `PUBLISHED -> HIDDEN`
- `HIDDEN -> PUBLISHED`
- `REJECTED -> PUBLISHED`

Required note:

- transitions to `HIDDEN`

## Hard Deletes

No hard delete moderation action is allowed in this milestone.
