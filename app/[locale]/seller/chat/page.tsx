import { BuyerPageShell } from "#/components/BuyerShell";
import { ChatInboxPage } from "#/features/chat";
import { requireSeller } from "#/lib/auth-server";

export default async function SellerChatPage() {
  await requireSeller();

  return (
    <BuyerPageShell>
      <ChatInboxPage audience="seller" />
    </BuyerPageShell>
  );
}
