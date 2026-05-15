export type NotificationType =
  | 'order_paid'
  | 'order_cancelled'
  | 'shipment_shipped'
  | 'shipment_delivered'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'refund_processing'
  | 'refund_success'
  | 'payout_paid'
  | 'coupon_available'
  | 'chat_message'

export type NotificationData = Record<string, unknown>
