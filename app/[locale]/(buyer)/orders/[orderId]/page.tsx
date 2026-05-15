import { OrderDetailPage } from "#/features/order";

export default async function OrderRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderDetailPage orderId={orderId} />;
}
