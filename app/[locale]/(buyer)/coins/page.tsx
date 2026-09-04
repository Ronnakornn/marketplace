import { BuyerCoinsPage } from "#/features/promotion/components/BuyerCoinsPage";
import { requireUser } from "#/lib/auth-server";

export default async function CoinsRoutePage() {
  await requireUser();
  return <BuyerCoinsPage />;
}
