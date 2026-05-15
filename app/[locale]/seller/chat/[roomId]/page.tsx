import { BuyerPageShell } from "#/components/BuyerShell";
import { ChatThreadPage } from "#/features/chat";
import { requireSeller } from "#/lib/auth-server";

export default async function SellerChatThreadPage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireSeller();
  const { roomId } = await params;

  return (
    <BuyerPageShell>
      <ChatThreadPage roomId={roomId} audience="seller" />
    </BuyerPageShell>
  );
}
