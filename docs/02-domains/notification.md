# Notification Domain

The Notification domain owns user-facing alerts for marketplace events.

## Responsibilities

- Buyer notifications
- Seller notifications
- Admin operational notifications
- Email or realtime hooks when enabled
- Notification read state

## Business Events

- Payment pending or failed
- Payment confirmed
- Shipment created
- Shipment shipped
- Shipment delivered
- Return/refund status changed
- Seller receives paid shipment
- Low stock alert
- Admin moderation or refund escalation

## API Surface

MVP notification APIs can be added after core commerce flows:
- `GET /api/notifications`
- `PATCH /api/notifications/:notificationId/read`

## Frontend Surfaces

- Account notification list
- Mobile bottom nav badges
- Seller dashboard alerts
- Admin dashboard exception cards

## Edge Cases

- Duplicate events.
- Notification delivered before UI refresh.
- User role changed after notification creation.

## Acceptance Criteria

- Notifications reference authorized resources only.
- Duplicate business events do not create confusing repeated alerts.
