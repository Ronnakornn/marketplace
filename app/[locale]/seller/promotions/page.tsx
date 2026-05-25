import { SellerPromotionsPage } from "#/features/seller";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerPromotionsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/promotions", locale);

  return <SellerPromotionsPage />;
}
