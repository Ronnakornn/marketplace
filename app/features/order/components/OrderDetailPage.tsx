"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleIcon, PackageCheckIcon, TruckIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cancelOrder, fetchOrder, formatMoney } from "#/features/buyer/api";
import { createChatRoom } from "#/features/chat";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";
import { formatOrderStatus } from "../order-status";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const t = useTranslations();
  const formatters = useFormatters();
  const localePath = useLocalePath();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canUseBuyerChat = session?.user.role === "USER";
  const orderQuery = useQuery({ queryKey: ["buyer-order", orderId], queryFn: () => fetchOrder(orderId) });
  const createChatMutation = useMutation({
    mutationFn: (shopId: string) => createChatRoom({ shopId, orderId }),
    onSuccess: (room) => {
      router.push(localePath(`/chat/${room.roomId}`));
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["buyer-order", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
  });

  return (
    <>
      <BuyerTopBar title={t("order.details")} />
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderQuery.data ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-950">{orderQuery.data.orderNo}</h1>
                  <p className="text-sm text-slate-500">{formatters.date(orderQuery.data.createdAt)}</p>
                </div>
                <Badge className="rounded-md bg-orange-600">{formatOrderStatus(orderQuery.data.status, t)}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label={t("order.payment")} value={formatOrderStatus(orderQuery.data.paymentStatus, t)} />
                <Info label={t("common.total")} value={formatMoney(orderQuery.data.totalCents, orderQuery.data.currency)} />
              </div>
              {orderQuery.data.status === "PENDING_PAYMENT" && ["PENDING", "REQUIRES_ACTION"].includes(orderQuery.data.paymentStatus) ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Button variant="outline" className="rounded-full text-red-700 hover:bg-red-50 hover:text-red-800" disabled={cancelMutation.isPending} onClick={() => { if (window.confirm(t("order.cancelConfirm"))) cancelMutation.mutate(); }}>{t("order.cancel")}</Button>
                  {cancelMutation.isError ? <p className="mt-2 text-sm text-red-600">{t("order.cancelError")}</p> : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><PackageCheckIcon className="size-5" />{t("order.items")}</h2>
              <div className="divide-y divide-slate-100">
                {orderQuery.data.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-950">{item.productTitle}</p>
                      <p className="text-slate-500">{item.variantTitle} - {item.shopName}</p>
                    </div>
                    <div className="text-right">
                      <p>x{item.quantity}</p>
                      <p className="font-semibold">{formatMoney(item.lineTotal, orderQuery.data.currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={localePath(`/orders/${orderQuery.data.id}/review`)}>{t("order.reviewItems")}</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={localePath(`/orders/${orderQuery.data.id}/returns/new`)}>{t("order.returnRefund")}</Link>
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><TruckIcon className="size-5" />{t("order.shipments")}</h2>
              <div className="space-y-3">
                {orderQuery.data.shipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{shipment.shopName}</p>
                        <p className="text-sm text-slate-500">{shipment.carrier ?? t("order.carrierPending")} {shipment.trackingNumber ?? ""}</p>
                      </div>
                      <Badge variant="outline" className="rounded-md">{formatOrderStatus(shipment.status, t)}</Badge>
                    </div>
                    {canUseBuyerChat ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-full"
                        disabled={createChatMutation.isPending}
                        onClick={() => createChatMutation.mutate(shipment.shopId)}
                      >
                        <MessageCircleIcon className="size-4" />
                        {t("chat.chatSeller")}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <Button asChild className="mt-4 bg-orange-600 hover:bg-orange-700"><Link href={localePath(`/orders/${orderQuery.data.id}/tracking`)}>{t("order.trackOrder")}</Link></Button>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}
