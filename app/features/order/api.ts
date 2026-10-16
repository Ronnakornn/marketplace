"use client";

import type { Treaty } from "@elysiajs/eden";
import { requestApi } from "#/lib/api-client";
import { api } from "#/lib/eden";

export type OrderListResponse = NonNullable<Treaty.Data<ReturnType<typeof api.api.orders.get>>>;
export type OrderListFilters = NonNullable<NonNullable<Parameters<typeof api.api.orders.get>[0]>["query"]>;

export async function fetchOrders(query: OrderListFilters = {}): Promise<OrderListResponse> {
  const { data, error } = await api.api.orders.get({ query });
  if (error) throw error;
  return data;
}

export type BuyAgainResult = NonNullable<Treaty.Data<ReturnType<ReturnType<typeof api.api.orders>["buy-again"]["post"]>>>;

export function buyAgain(orderId: string): Promise<BuyAgainResult> {
  return requestApi<BuyAgainResult>(`/api/orders/${orderId}/buy-again`, { method: "POST" });
}
