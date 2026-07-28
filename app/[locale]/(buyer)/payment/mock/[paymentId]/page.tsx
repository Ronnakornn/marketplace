import { MockPaymentPage } from "#/features/payment";
import { requireUser } from "#/lib/auth-server";

export default async function MockPaymentRoutePage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  await requireUser();
  const { paymentId } = await params;

  return <MockPaymentPage paymentId={paymentId} />;
}
