import { OrderReviewPage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function OrderReviewRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;
  return <OrderReviewPage orderId={orderId} />;
}
