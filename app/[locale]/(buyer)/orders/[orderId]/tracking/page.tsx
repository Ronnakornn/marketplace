import { OrderTrackingPage } from "#/features/order";
import { requireUser } from "#/lib/auth-server";

export default async function OrderTrackingRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;
  return <OrderTrackingPage orderId={orderId} />;
}
