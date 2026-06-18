# Goal: Product Q&A Moderation

## Outcome

Admins can moderate product questions and seller answers while preserving published Q&A behavior from milestone 10.

## Scope

- Support question status transitions:
  - `PENDING -> PUBLISHED`
  - `PUBLISHED/PENDING -> HIDDEN`
  - `HIDDEN/REJECTED -> PUBLISHED`
- Support answer status transitions:
  - `PENDING -> PUBLISHED`
  - `PUBLISHED/PENDING -> HIDDEN`
  - `HIDDEN/REJECTED -> PUBLISHED`
- Require moderation notes for hide and reject-like actions.
- Do not add threaded replies, voting, or reports for Q&A in this milestone.

## Success Criteria

- Public Q&A APIs return only published questions and published answers.
- Admins can restore hidden Q&A content to published state.
- Seller answer behavior remains server-side ownership-validated.
- Focused tests cover question and answer moderation transitions.
