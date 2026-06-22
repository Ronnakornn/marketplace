import { SellerOrdersPage } from "#/features/seller/components/SellerManagePages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerOrdersRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/orders", locale);

  return <SellerOrdersPage />;
}
