import { NotificationsPage } from "#/features/order";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/notifications", locale);

  return <NotificationsPage showTopBar={false} scope="seller" />;
}
