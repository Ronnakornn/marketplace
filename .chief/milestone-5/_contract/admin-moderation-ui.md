# Contract: Admin Moderation UI

## Moderation Queue

Required behavior:

- filters for pending review, active, rejected, suspended, and archived
- search by product, shop, category, or seller
- rows show product thumbnail, title, shop, category, status, readiness flags, and submitted date
- loading, empty, error, and forbidden states

## Moderation Detail

Required behavior:

- product media preview
- product basics
- category specs
- variant matrix summary
- inventory summary
- shop context
- readiness checklist
- moderation signals when available
- moderation history when available

## Actions

Required actions:

- approve
- reject with reason
- suspend with reason
- restore

Rules:

- Actions show confirmation or review before irreversible changes.
- Reject and suspend cannot submit without a non-empty reason.
- Mutations show pending and result states.
