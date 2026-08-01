import { VoucherWalletPage } from "#/features/buyer";
import { requireUser } from "#/lib/auth-server";

export default async function VouchersRoutePage() {
  await requireUser();

  return <VoucherWalletPage />;
}
