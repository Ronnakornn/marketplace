"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchOrders, formatMoney } from "#/features/buyer/api";
import { useLocalePath } from "#/i18n/navigation";

const orderFilters = [
  { value: "all", label: "All" },
  { value: "pending_payment", label: "To pay" },
  { value: "paid", label: "Paid" },
  { value: "shipped", label: "Shipping" },
  { value: "delivered", label: "Delivered" },
  { value: "canceled", label: "Canceled" },
  { value: "refunded", label: "Refunded" },
];

export function OrderListPage() {
  const localePath = useLocalePath();
  const [filter, setFilter] = useState("all");
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: fetchOrders });
  const orders = useMemo(() => {
    const data = ordersQuery.data ?? [];
    if (filter === "all") return data;
    return data.filter((order) => order.status.toLowerCase() === filter || order.paymentStatus.toLowerCase() === filter);
  }, [filter, ordersQuery.data]);

  return (
    <>
      <BuyerTopBar title="Orders" />
      <div className="mx-auto max-w-5xl space-y-3 px-3 py-4">
        <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          {orderFilters.map((item) => (
            <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "ghost"} className={filter === item.value ? "rounded-full bg-orange-600 hover:bg-orange-700" : "rounded-full"} onClick={() => setFilter(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
        {ordersQuery.isLoading ? <BuyerLoadingList /> : null}
        {ordersQuery.isError ? <BuyerErrorState message={ordersQuery.error.message} onRetry={() => void ordersQuery.refetch()} /> : null}
        {ordersQuery.isSuccess && ordersQuery.data.length === 0 ? <BuyerEmptyState title="No orders yet" description="Paid and in-progress orders will appear here." /> : null}
        {ordersQuery.isSuccess && ordersQuery.data.length > 0 && orders.length === 0 ? <BuyerEmptyState title="No orders in this tab" description="Try another status filter." /> : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{order.orderNo}</h2>
                <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <Badge variant="secondary" className="rounded-md">{order.status}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {order.items.slice(0, 2).map((item) => <p key={item.id}>{item.quantity} x {item.productTitle}</p>)}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="font-bold text-orange-600">{formatMoney(order.totalCents, order.currency)}</p>
              <Button asChild variant="outline" size="sm"><Link href={localePath(`/orders/${order.id}`)}>Details</Link></Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
