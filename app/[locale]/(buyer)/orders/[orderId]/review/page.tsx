import { OrderReviewPage } from "#/features/buyer";

export default async function OrderReviewRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderReviewPage orderId={orderId} />;
}
