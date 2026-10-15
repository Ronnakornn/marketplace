import { ChatThreadPage } from "#/features/chat";
import { requireUser } from "#/lib/auth-server";

export default async function BuyerChatThreadPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ productId?: string; orderId?: string }>;
}) {
  await requireUser();
  const [{ roomId }, context] = await Promise.all([params, searchParams]);

  return <ChatThreadPage roomId={roomId} audience="buyer" productId={validId(context.productId)} orderId={validId(context.orderId)} />;
}

function validId(value?: string) {
  return value && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) ? value : undefined;
}
