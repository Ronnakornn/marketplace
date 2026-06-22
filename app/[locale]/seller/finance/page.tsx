import { SellerFinancePage } from "#/features/seller/components/SellerManagePages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerFinanceRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/finance", locale);

  return <SellerFinancePage />;
}
