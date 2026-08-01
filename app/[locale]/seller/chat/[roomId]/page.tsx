import { ChatThreadPage } from "#/features/chat";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerChatThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; roomId: string }>;
  searchParams: Promise<{ shopId?: string }>;
}) {
  const [{ locale, roomId }, { shopId }] = await Promise.all([params, searchParams]);
  await enforceSellerRoute(`/seller/chat/${roomId}`, locale);

  return <ChatThreadPage roomId={roomId} audience="seller" shopId={shopId} />;
}
