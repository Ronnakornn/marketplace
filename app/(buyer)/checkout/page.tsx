import { CheckoutPage } from "#/features/checkout";

export default async function CheckoutRoutePage({ searchParams }: { searchParams: Promise<{ status?: string; orderId?: string }> }) {
  const { status, orderId } = await searchParams;
  return <CheckoutPage resultStatus={status} orderId={orderId} />;
}
