import { ChatInboxPage } from "#/features/chat";
import { requireUser } from "#/lib/auth-server";

export default async function BuyerChatPage() {
  await requireUser();

  return <ChatInboxPage audience="buyer" />;
}
