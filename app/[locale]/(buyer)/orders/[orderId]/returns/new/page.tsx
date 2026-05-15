import { ReturnRequestPage } from "#/features/buyer";

export default async function ReturnRequestRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ReturnRequestPage orderId={orderId} />;
}
