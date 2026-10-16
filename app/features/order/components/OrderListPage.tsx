"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { formatMoney } from "#/features/buyer/api";
import { fetchOrders, type OrderListFilters } from "../api";
import { Input } from "#/components/ui/input";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { formatOrderStatus } from "../order-status";

const orderFilters = [
  { value: "all", labelKey: "order.all" },
  { value: "PENDING_PAYMENT", labelKey: "order.toPay" },
  { value: "PAID", labelKey: "order.paid" },
  { value: "SHIPPED", labelKey: "order.shipping" },
  { value: "DELIVERED", labelKey: "order.delivered" },
  { value: "CANCELED", labelKey: "order.canceled" },
  { value: "REFUNDED", labelKey: "order.refunded" },
] as const;

export function OrderListPage() {
  const localePath = useLocalePath();
  const t = useTranslations();
  const formatters = useFormatters();
  const [filter, setFilter] = useState<(typeof orderFilters)[number]["value"]>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query: OrderListFilters = { page, limit: 20, q: search.trim() || undefined, status: filter === "all" ? undefined : filter };
  const ordersQuery = useQuery({ queryKey: ["buyer-orders", query], queryFn: () => fetchOrders(query) });
  const orders = ordersQuery.data?.data ?? [];

  return (
    <>
      <BuyerTopBar title={t("common.orders")} />
      <div className="mx-auto max-w-5xl space-y-3 px-3 py-4">
        <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          {orderFilters.map((item) => (
            <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "ghost"} className={filter === item.value ? "rounded-full bg-orange-600 hover:bg-orange-700" : "rounded-full"} onClick={() => { setFilter(item.value); setPage(1); }}>
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label={t("common.search")} placeholder={t("common.search")} />
        {ordersQuery.isLoading ? <BuyerLoadingList /> : null}
        {ordersQuery.isError ? <BuyerErrorState message={ordersQuery.error.message} onRetry={() => void ordersQuery.refetch()} /> : null}
        {ordersQuery.isSuccess && orders.length === 0 ? <BuyerEmptyState title={t(filter === "all" && !search ? "order.noOrdersTitle" : "order.noOrdersTabTitle")} description={t(filter === "all" && !search ? "order.noOrdersDescription" : "order.noOrdersTabDescription")} /> : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{order.orderNo}</h2>
                <p className="text-sm text-slate-500">{formatters.date(order.createdAt)}</p>
              </div>
              <Badge variant="secondary" className="rounded-md">{formatOrderStatus(order.status, t)}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {order.items.slice(0, 2).map((item) => <p key={item.id}>{item.quantity} x {item.productTitle}</p>)}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="font-bold text-orange-600">{formatMoney(order.totals.grandTotal, order.totals.currency)}</p>
              <Button asChild variant="outline" size="sm"><Link href={localePath(`/orders/${order.id}`)}>{t("order.details")}</Link></Button>
            </div>
          </article>
        ))}
        {ordersQuery.data ? <nav className="flex items-center justify-between gap-3" aria-label={t("common.orders")}>
          <Button variant="outline" disabled={!ordersQuery.data.meta.hasPreviousPage || ordersQuery.isFetching} onClick={() => setPage((current) => current - 1)}>{t("common.previous")}</Button>
          <span className="text-sm text-slate-500">{page} / {Math.max(1, ordersQuery.data.meta.totalPages)}</span>
          <Button variant="outline" disabled={!ordersQuery.data.meta.hasNextPage || ordersQuery.isFetching} onClick={() => setPage((current) => current + 1)}>{t("common.next")}</Button>
        </nav> : null}
      </div>
    </>
  );
}
