"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { fetchOrder, formatMoney } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

const PAYMENT_POLL_INTERVAL_MS = 2_000;
const PAYMENT_POLL_TIMEOUT_MS = 45_000;

export function PaymentReturnPage({ orderId }: { orderId?: string }) {
  const localePath = useLocalePath();
  const t = useTranslations();
  const pollingDeadline = useMemo(() => Date.now() + PAYMENT_POLL_TIMEOUT_MS, [orderId]);
  const orderQuery = useQuery({
    queryKey: ["buyer-order", orderId],
    queryFn: () => fetchOrder(orderId ?? ""),
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.paymentStatus.toLowerCase();
      if (status !== "pending" && status !== "requires_action") return false;

      const remainingWait = pollingDeadline - Date.now();
      return remainingWait > 0 ? Math.min(PAYMENT_POLL_INTERVAL_MS, remainingWait) : false;
    },
  });
  const copy = orderQuery.data ? paymentCopy(orderQuery.data.paymentStatus.toLowerCase(), t) : null;
  const StatusIcon = copy?.Icon;

  return (
    <>
      <BuyerTopBar title={t("buyer.paymentStatus")} />
      <div className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4">
        {!orderId ? (
          <BuyerErrorState message={t("buyer.missingOrderId")} />
        ) : null}
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderQuery.data && copy && StatusIcon ? (
          <Alert className={copy.className}>
            <StatusIcon className="size-5" />
            <AlertTitle>{copy.title}</AlertTitle>
            <AlertDescription>{copy.description}</AlertDescription>
          </Alert>
        ) : null}
        {orderQuery.data ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{t("buyer.orderNumber")}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{orderQuery.data.orderNo}</h1>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info label={t("order.payment")} value={orderQuery.data.paymentStatus} />
              <Info label={t("common.total")} value={formatMoney(orderQuery.data.totalCents, orderQuery.data.currency)} />
            </div>
          </section>
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button asChild className="flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700">
              <Link href={orderId ? localePath(`/orders/${orderId}`) : localePath("/orders")}>{t("buyer.viewOrder")}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={localePath("/")}>{t("buyer.shopMore")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function paymentCopy(status: string, t: ReturnType<typeof useTranslations>) {
  if (status === "succeeded") {
    return {
      Icon: CheckCircle2Icon,
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      title: t("buyer.paymentConfirmed"),
      description: t("buyer.paymentConfirmedDescription"),
    };
  }
  if (status === "failed" || status === "canceled") {
    return {
      Icon: XCircleIcon,
      className: "border-red-200 bg-red-50 text-red-950",
      title: t("buyer.paymentNotCompleted"),
      description: t("buyer.paymentNotCompletedDescription"),
    };
  }
  if (status === "refunded") {
    return {
      Icon: AlertCircleIcon,
      className: "border-slate-200 bg-slate-50 text-slate-950",
      title: t("buyer.paymentRefunded"),
      description: t("buyer.paymentRefundedDescription"),
    };
  }
  return {
    Icon: ClockIcon,
    className: "border-orange-200 bg-orange-50 text-orange-950",
    title: t("buyer.waitingPayment"),
    description: t("buyer.waitingPaymentDescription"),
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
