import { SellerInventoryPage } from "#/features/seller/components/SellerManagePages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerInventoryRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/inventory", locale);

  return <SellerInventoryPage />;
}
