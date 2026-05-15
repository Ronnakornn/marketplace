import { PaymentReturnPage } from "#/features/buyer";

export default async function PaymentReturnRoutePage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const { orderId } = await searchParams;
  return <PaymentReturnPage orderId={orderId} />;
}
