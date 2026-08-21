import { CartPage } from "#/features/cart";
import { requireUser } from "#/lib/auth-server";

export default async function CartRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ voucher?: string }>;
}) {
  await requireUser();
  const { voucher } = await searchParams;

  return <CartPage initialVoucher={voucher?.trim().slice(0, 64) ?? ""} />;
}
