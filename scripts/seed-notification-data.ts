type DemoOrderReference = {
  id: string;
  orderNumber: string;
};

export function buildDemoNotificationSeeds(input: {
  sellerEmail: string;
  paidOrder: DemoOrderReference;
  deliveredOrder: DemoOrderReference;
}) {
  return [
    ["buyer.demo@example.com", "ORDER_PAID", "Payment received", {
      seeded: true,
      orderId: input.paidOrder.id,
      orderNo: input.paidOrder.orderNumber,
    }],
    [input.sellerEmail, "SHIPMENT_READY", "New shipment ready", {
      seeded: true,
      audience: "seller",
      orderId: input.paidOrder.id,
      targetPath: "/seller/orders",
    }],
    ["buyer.return@example.com", "REFUND_SUCCESS", "Refund completed", {
      seeded: true,
      orderId: input.deliveredOrder.id,
      orderNo: input.deliveredOrder.orderNumber,
    }],
  ] as const;
}
