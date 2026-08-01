import { OrderDetailPage } from "#/features/order";
import { requireUser } from "#/lib/auth-server";

export default async function OrderRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;
  return <OrderDetailPage orderId={orderId} />;
}
