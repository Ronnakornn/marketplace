import { SellerProductCreatePage } from "#/features/seller/components/SellerProductPages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerProductCreateRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/products/create", locale);

  return <SellerProductCreatePage />;
}
