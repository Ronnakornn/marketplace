import { ReturnRequestPage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function ReturnRequestRoutePage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;
  return <ReturnRequestPage orderId={orderId} />;
}
