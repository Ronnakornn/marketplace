import { SellerShopProfilePage } from "#/features/seller/components/SellerManagePages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerShopProfileRoute({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ shopId?: string }> }) {
  const { locale } = await params;
  const { shopId } = await searchParams;
  await enforceSellerRoute("/seller/shop", locale);
  return <SellerShopProfilePage shopId={shopId} />;
}
