import { ChatThreadPage } from "#/features/chat";
import { requireUser } from "#/lib/auth-server";

export default async function BuyerChatThreadPage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireUser();
  const { roomId } = await params;

  return <ChatThreadPage roomId={roomId} audience="buyer" />;
}
