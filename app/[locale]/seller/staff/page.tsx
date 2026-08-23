import { SellerStaffPage } from "#/features/seller";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerStaffRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/staff", locale);
  return <SellerStaffPage />;
}
