import { ChatThreadPage } from "#/features/chat";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerChatThreadPage({ params }: { params: Promise<{ locale: string; roomId: string }> }) {
  const { locale, roomId } = await params;
  await enforceSellerRoute("/seller/chat", locale);

  return <ChatThreadPage roomId={roomId} audience="seller" />;
}
