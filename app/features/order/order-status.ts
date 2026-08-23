const statusKeys: Record<string, string> = {
  PENDING_PAYMENT: "order.statuses.pendingPayment",
  PAID: "order.statuses.paid",
  PROCESSING: "order.statuses.processing",
  PARTIALLY_SHIPPED: "order.statuses.partiallyShipped",
  SHIPPED: "order.statuses.shipped",
  DELIVERED: "order.statuses.delivered",
  PARTIALLY_FULFILLED: "order.statuses.partiallyFulfilled",
  FULFILLED: "order.statuses.fulfilled",
  CANCELED: "order.statuses.canceled",
  REFUNDED: "order.statuses.refunded",
  REQUIRES_ACTION: "order.statuses.requiresAction",
  PENDING: "order.statuses.pending",
  SUCCEEDED: "order.statuses.succeeded",
  FAILED: "order.statuses.failed",
  PENDING_PACK: "order.statuses.pendingPack",
  PACKED: "order.statuses.packed",
  READY: "order.statuses.ready",
};

export function formatOrderStatus(status: string, t: (key: never) => string): string {
  return t((statusKeys[status.toUpperCase()] ?? "order.statuses.unknown") as never);
}
