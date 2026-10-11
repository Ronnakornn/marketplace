"use client";

import type { Treaty } from "@elysiajs/eden";
import { requestApi } from "#/lib/api-client";
import type { api } from "#/lib/eden";

export type BuyAgainResult = NonNullable<Treaty.Data<ReturnType<ReturnType<typeof api.api.orders>["buy-again"]["post"]>>>;

export function buyAgain(orderId: string): Promise<BuyAgainResult> {
  return requestApi<BuyAgainResult>(`/api/orders/${orderId}/buy-again`, { method: "POST" });
}
