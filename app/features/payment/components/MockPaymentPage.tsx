"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, CreditCardIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import {
  createBuyerMockPaymentEvent,
  fetchBuyerMockPayment,
  type MockPaymentEventType,
} from "../api";

const terminalPaymentStatuses = new Set(["SUCCEEDED", "FAILED", "CANCELED", "REFUNDED"]);

export function MockPaymentPage({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const localePath = useLocalePath();
  const formatters = useFormatters();
  const t = useTranslations();
  const paymentQuery = useQuery({
    queryKey: ["buyer-mock-payment", paymentId],
    queryFn: () => fetchBuyerMockPayment(paymentId),
  });
  const eventMutation = useMutation({
    mutationFn: (eventType: MockPaymentEventType) => createBuyerMockPaymentEvent(paymentId, eventType),
    onSuccess: () => {
      if (paymentQuery.data) {
        router.push(localePath(`/payment/return?orderId=${paymentQuery.data.orderId}`));
      }
    },
  });
  const actionsDisabled = !paymentQuery.data
    || terminalPaymentStatuses.has(paymentQuery.data.status)
    || eventMutation.isPending;

  return (
    <>
      <BuyerTopBar title={t("buyer.paymentStatus")} />
      <main className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4">
        {paymentQuery.isLoading ? <BuyerLoadingList /> : null}
        {paymentQuery.isError ? (
          <BuyerErrorState message={paymentQuery.error.message} onRetry={() => void paymentQuery.refetch()} />
        ) : null}

        {paymentQuery.data ? (
          <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-orange-600 to-amber-500 px-5 py-6 text-white">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/20">
                  <CreditCardIcon className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-orange-50">{t("order.order")}</p>
                  <h1 className="text-2xl font-extrabold">{paymentQuery.data.orderNo}</h1>
                </div>
              </div>
              <p className="mt-6 text-sm font-semibold text-orange-50">{t("order.amount")}</p>
              <p className="mt-1 text-3xl font-extrabold">
                {formatters.currency(paymentQuery.data.amountCents, paymentQuery.data.currency)}
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="size-5 text-orange-600" />
                  <span className="font-semibold text-slate-700">{t("buyer.paymentStatus")}</span>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-950 shadow-sm">
                  {paymentQuery.data.status}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={actionsDisabled}
                  onClick={() => eventMutation.mutate("payment.paid")}
                >
                  <CheckCircle2Icon className="size-5" />
                  {t("buyer.paymentConfirmed")}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={actionsDisabled}
                  onClick={() => eventMutation.mutate("payment.failed")}
                >
                  <XCircleIcon className="size-5" />
                  {t("buyer.paymentNotCompleted")}
                </Button>
              </div>

              {eventMutation.isError ? <p className="text-sm text-red-600">{eventMutation.error.message}</p> : null}
              {terminalPaymentStatuses.has(paymentQuery.data.status) ? (
                <p className="text-sm text-slate-600">{t("buyer.paymentStatus")}: {paymentQuery.data.status}</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
