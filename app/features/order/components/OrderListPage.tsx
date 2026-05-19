"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchOrders, formatMoney } from "#/features/buyer/api";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

const orderFilters = [
  { value: "all", labelKey: "order.all" },
  { value: "pending_payment", labelKey: "order.toPay" },
  { value: "paid", labelKey: "order.paid" },
  { value: "shipped", labelKey: "order.shipping" },
  { value: "delivered", labelKey: "order.delivered" },
  { value: "canceled", labelKey: "order.canceled" },
  { value: "refunded", labelKey: "order.refunded" },
] as const;

export function OrderListPage() {
  const localePath = useLocalePath();
  const t = useTranslations();
  const formatters = useFormatters();
  const [filter, setFilter] = useState("all");
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: fetchOrders });
  const orders = useMemo(() => {
    const data = ordersQuery.data ?? [];
    if (filter === "all") return data;
    return data.filter((order) => order.status.toLowerCase() === filter || order.paymentStatus.toLowerCase() === filter);
  }, [filter, ordersQuery.data]);

  return (
    <>
      <BuyerTopBar title={t("common.orders")} />
      <div className="mx-auto max-w-5xl space-y-3 px-3 py-4">
        <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          {orderFilters.map((item) => (
            <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "ghost"} className={filter === item.value ? "rounded-full bg-orange-600 hover:bg-orange-700" : "rounded-full"} onClick={() => setFilter(item.value)}>
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
        {ordersQuery.isLoading ? <BuyerLoadingList /> : null}
        {ordersQuery.isError ? <BuyerErrorState message={ordersQuery.error.message} onRetry={() => void ordersQuery.refetch()} /> : null}
        {ordersQuery.isSuccess && ordersQuery.data.length === 0 ? <BuyerEmptyState title={t("order.noOrdersTitle")} description={t("order.noOrdersDescription")} /> : null}
        {ordersQuery.isSuccess && ordersQuery.data.length > 0 && orders.length === 0 ? <BuyerEmptyState title={t("order.noOrdersTabTitle")} description={t("order.noOrdersTabDescription")} /> : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{order.orderNo}</h2>
                <p className="text-sm text-slate-500">{formatters.date(order.createdAt)}</p>
              </div>
              <Badge variant="secondary" className="rounded-md">{order.status}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {order.items.slice(0, 2).map((item) => <p key={item.id}>{item.quantity} x {item.productTitle}</p>)}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="font-bold text-orange-600">{formatMoney(order.totalCents, order.currency)}</p>
              <Button asChild variant="outline" size="sm"><Link href={localePath(`/orders/${order.id}`)}>{t("order.details")}</Link></Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
