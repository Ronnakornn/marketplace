import { BuyerPageShell } from "#/components/BuyerShell";
import { NotificationsPage } from "#/features/order";
import { requireSeller } from "#/lib/auth-server";

export default async function SellerNotificationsPage() {
  await requireSeller();

  return (
    <BuyerPageShell>
      <NotificationsPage />
    </BuyerPageShell>
  );
}
