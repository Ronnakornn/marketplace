import { SellerProductEditPage } from "#/features/seller";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerProductRoute({ params }: { params: Promise<{ locale: string; productId: string }> }) {
  const { locale, productId } = await params;
  await enforceSellerRoute(`/seller/products/${productId}`, locale);

  return <SellerProductEditPage productId={productId} />;
}
