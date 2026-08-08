const statusKeys: Record<string, string> = {
  PENDING_PAYMENT: "order.status.pendingPayment",
  PAID: "order.status.paid",
  PROCESSING: "order.status.processing",
  PARTIALLY_SHIPPED: "order.status.partiallyShipped",
  SHIPPED: "order.status.shipped",
  DELIVERED: "order.status.delivered",
  PARTIALLY_FULFILLED: "order.status.partiallyFulfilled",
  FULFILLED: "order.status.fulfilled",
  CANCELED: "order.status.canceled",
  REFUNDED: "order.status.refunded",
  REQUIRES_ACTION: "order.status.requiresAction",
  PENDING: "order.status.pending",
  SUCCEEDED: "order.status.succeeded",
  FAILED: "order.status.failed",
  PENDING_PACK: "order.status.pendingPack",
  PACKED: "order.status.packed",
  READY: "order.status.ready",
};

export function formatOrderStatus(status: string, t: (key: never) => string): string {
  return t((statusKeys[status.toUpperCase()] ?? "order.status.unknown") as never);
}
