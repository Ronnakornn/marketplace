import { ChatThreadPage } from "#/features/chat";
import { enforceSellerRoute } from "#/lib/seller-route-guard";
import { getSellerAccess } from "#/lib/auth-server";

export default async function SellerChatThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; roomId: string }>;
  searchParams: Promise<{ shopId?: string }>;
}) {
  const [{ locale, roomId }, { shopId }] = await Promise.all([params, searchParams]);
  await enforceSellerRoute(`/seller/chat/${roomId}`, locale);

  const access = await getSellerAccess();
  return <ChatThreadPage roomId={roomId} audience="seller" shopId={shopId ?? access.activeShop?.id} />;
}
