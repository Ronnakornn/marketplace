import { SellerProductEditPage } from "#/features/seller";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerProductEditRoute({ params }: { params: Promise<{ locale: string; productId: string }> }) {
  const { locale, productId } = await params;
  await enforceSellerRoute(`/seller/products/${productId}/edit`, locale);

  return <SellerProductEditPage productId={productId} />;
}
