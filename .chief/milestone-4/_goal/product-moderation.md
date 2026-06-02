# Goal: Product Moderation Flow

## Outcome

Products follow a reviewable lifecycle before buyer-visible sale, using existing moderation infrastructure where possible.

## Scope

- Extend product status flow to include pending review, rejected, and suspended states.
- Use existing `ModerationCase` and moderation actions for review details unless a contract proves insufficient.
- Add seller submit-for-review behavior.
- Add admin approve, reject, suspend, and restore behavior.

## Success Criteria

- Public catalog exposes only active products from active shops.
- Sellers can see review status and rejection reasons.
- Admin actions are protected by admin auth macros.
- Moderation actions are auditable and do not require a new table unless existing moderation contracts cannot represent the workflow.
