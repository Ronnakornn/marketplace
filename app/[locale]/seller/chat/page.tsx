import { ChatInboxPage } from "#/features/chat";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shopId?: string }>;
}) {
  const [{ locale }, { shopId }] = await Promise.all([params, searchParams]);
  await enforceSellerRoute("/seller/chat", locale);

  return <ChatInboxPage audience="seller" shopId={shopId} />;
}
