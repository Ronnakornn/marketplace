import { mergeGuestCartItem } from "#/features/buyer/api";
import { readGuestCart, writeGuestCart } from "./guest-cart";

let activeUserId: string | null = null;
let sessionVersion = 0;
let tail: Promise<void> = Promise.resolve();
const inFlight = new Map<string, { version: number; operation: Promise<void> }>();

export function mergeGuestCart(userId: string | null): Promise<void> {
  if (activeUserId !== userId) {
    activeUserId = userId;
    sessionVersion += 1;
  }
  if (userId === null) return tail;
  const version = sessionVersion;
  const pending = inFlight.get(userId);
  if (pending?.version === version) return pending.operation;
  const operation = tail.then(() => mergeItems(userId, version)).finally(() => {
    if (inFlight.get(userId)?.operation === operation) inFlight.delete(userId);
  });
  inFlight.set(userId, { version, operation });
  tail = operation.catch(() => {});
  return operation;
}

async function mergeItems(userId: string, version: number): Promise<void> {
  if (version !== sessionVersion) return;
  const quantities = new Map<string, number>();
  for (const item of readGuestCart()) {
    quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  }
  for (const [variantId, quantity] of quantities) {
    if (version !== sessionVersion) return;
    try {
      const { addedQuantity } = await mergeGuestCartItem(userId, variantId, quantity);
      if (!Number.isInteger(addedQuantity) || addedQuantity <= 0 || addedQuantity > quantity) continue;
      let acknowledged = addedQuantity;
      const remaining = readGuestCart().flatMap(item => {
        if (item.variantId !== variantId) return [item];
        const removed = Math.min(item.quantity, acknowledged);
        acknowledged -= removed;
        return item.quantity > removed ? [{ ...item, quantity: item.quantity - removed }] : [];
      });
      writeGuestCart(remaining);
    } catch {}
  }
}
