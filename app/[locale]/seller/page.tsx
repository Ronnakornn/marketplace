import { SellerDashboardPage } from "#/features/seller/components/SellerManagePages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller", locale);

  return <SellerDashboardPage />;
}
