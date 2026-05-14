"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchOrders, formatMoney } from "#/features/buyer/api";

export function OrderListPage() {
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: fetchOrders });

  return (
    <>
      <BuyerTopBar title="Orders" />
      <div className="mx-auto max-w-5xl space-y-3 px-3 py-4">
        {ordersQuery.isLoading ? <BuyerLoadingList /> : null}
        {ordersQuery.isError ? <BuyerErrorState message={ordersQuery.error.message} onRetry={() => void ordersQuery.refetch()} /> : null}
        {ordersQuery.isSuccess && ordersQuery.data.length === 0 ? <BuyerEmptyState title="ยังไม่มีคำสั่งซื้อ" description="คำสั่งซื้อที่ชำระเงินหรือกำลังดำเนินการจะแสดงที่นี่" /> : null}
        {ordersQuery.data?.map((order) => (
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
              <Button asChild variant="outline" size="sm"><Link href={`/orders/${order.id}`}>Details</Link></Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
