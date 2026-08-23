import { CartPage } from "#/features/cart";

export default async function CartRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ voucher?: string }>;
}) {
  const { voucher } = await searchParams;

  return <CartPage initialVoucher={voucher?.trim().slice(0, 64) ?? ""} />;
}
