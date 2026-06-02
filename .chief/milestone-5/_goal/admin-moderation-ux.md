# Goal: Admin Product Moderation UX

## Outcome

Admins can review submitted products through a queue and detail checklist with traceable decisions.

## Scope

- Add moderation queue filters for pending, active, rejected, suspended, and archived products.
- Add product moderation detail checklist.
- Show media, variants, specs, inventory summary, shop context, and moderation signals.
- Support approve, reject, suspend, and restore actions.
- Require reason input for reject and suspend.
- Show moderation history from existing moderation or audit data.
- Do not implement assignment workflow, SLA dashboard, or bulk moderation.

## Success Criteria

- Admin moderation actions are visually confirmed and mutation-safe.
- Reject and suspend cannot submit without reason.
- Moderation history is visible when available.
- Queue and detail screens handle loading, empty, error, and forbidden states.
