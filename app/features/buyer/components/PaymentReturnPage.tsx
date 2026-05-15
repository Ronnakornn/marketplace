"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { fetchOrder, formatMoney } from "#/features/buyer/api";
import { useLocalePath } from "#/i18n/navigation";

export function PaymentReturnPage({ orderId }: { orderId?: string }) {
  const localePath = useLocalePath();
  const orderQuery = useQuery({
    queryKey: ["buyer-order", orderId],
    queryFn: () => fetchOrder(orderId ?? ""),
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.paymentStatus.toLowerCase();
      return status === "pending" || status === "requires_action" ? 5000 : false;
    },
  });
  const status = orderQuery.data?.paymentStatus.toLowerCase() ?? "pending";
  const copy = paymentCopy(status);
  const StatusIcon = copy.Icon;

  return (
    <>
      <BuyerTopBar title="Payment status" />
      <div className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4">
        {!orderId ? (
          <BuyerErrorState message="Missing order id. Open your orders to check the latest payment state." />
        ) : null}
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderId ? (
          <Alert className={copy.className}>
            <StatusIcon className="size-5" />
            <AlertTitle>{copy.title}</AlertTitle>
            <AlertDescription>{copy.description}</AlertDescription>
          </Alert>
        ) : null}
        {orderQuery.data ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Order number</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{orderQuery.data.orderNo}</h1>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info label="Payment" value={orderQuery.data.paymentStatus} />
              <Info label="Total" value={formatMoney(orderQuery.data.totalCents, orderQuery.data.currency)} />
            </div>
          </section>
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button asChild className="flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700">
              <Link href={orderId ? localePath(`/orders/${orderId}`) : localePath("/orders")}>View order</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={localePath("/")}>Shop more</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function paymentCopy(status: string) {
  if (status === "succeeded") {
    return {
      Icon: CheckCircle2Icon,
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      title: "Payment confirmed",
      description: "The backend has confirmed payment from the provider webhook. Sellers can start fulfillment.",
    };
  }
  if (status === "failed" || status === "canceled") {
    return {
      Icon: XCircleIcon,
      className: "border-red-200 bg-red-50 text-red-950",
      title: "Payment was not completed",
      description: "The order was not marked paid. Check the order page for retry or recovery options.",
    };
  }
  if (status === "refunded") {
    return {
      Icon: AlertCircleIcon,
      className: "border-slate-200 bg-slate-50 text-slate-950",
      title: "Payment refunded",
      description: "A refund status is recorded for this order.",
    };
  }
  return {
    Icon: ClockIcon,
    className: "border-orange-200 bg-orange-50 text-orange-950",
    title: "Waiting for payment confirmation",
    description: "This page stays pending until the verified payment webhook updates the order. Browser redirects are not treated as proof of payment.",
  };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}
