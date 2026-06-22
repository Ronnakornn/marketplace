import { SellerProductsPage } from "#/features/seller/components/SellerProductPages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerProductsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/products", locale);

  return <SellerProductsPage />;
}
