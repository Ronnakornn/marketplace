import { SellerStatusPage } from "#/features/seller/components/SellerOnboardingPages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/status", locale);

  return <SellerStatusPage />;
}
