import { ChatInboxPage } from "#/features/chat";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

export default async function SellerChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await enforceSellerRoute("/seller/chat", locale);

  return <ChatInboxPage audience="seller" />;
}
