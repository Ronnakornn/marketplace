import { SellerProductCreatePage } from "#/features/seller/components/SellerProductPages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerProductNewRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/products/new", locale);

  return <SellerProductCreatePage />;
}
