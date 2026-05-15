import { OrderTrackingPage } from "#/features/order";

export default async function OrderTrackingRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderTrackingPage orderId={orderId} />;
}
