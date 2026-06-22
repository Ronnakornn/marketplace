import { SellerProductAnalyticsPage } from "#/features/seller";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerProductAnalyticsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/analytics/products", locale);
  return <SellerProductAnalyticsPage />;
}
