import { ChatThreadPage } from "#/features/chat";

export default async function SellerChatThreadPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return <ChatThreadPage roomId={roomId} audience="seller" />;
}
