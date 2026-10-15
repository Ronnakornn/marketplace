import { ChatInboxPage } from "#/features/chat";
import { enforceSellerRoute } from "#/lib/seller-route-guard";
import { getSellerAccess } from "#/lib/auth-server";

export default async function SellerChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shopId?: string }>;
}) {
  const [{ locale }, { shopId }] = await Promise.all([params, searchParams]);
  await enforceSellerRoute("/seller/chat", locale);

  const access = await getSellerAccess();
  return <ChatInboxPage audience="seller" shopId={shopId ?? access.activeShop?.id} />;
}
