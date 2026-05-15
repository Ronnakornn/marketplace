"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircleIcon, PackageCheckIcon, TruckIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchOrder, formatMoney } from "#/features/buyer/api";
import { createChatRoom } from "#/features/chat";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const t = useTranslations();
  const localePath = useLocalePath();
  const { data: session } = useSession();
  const canUseBuyerChat = session?.user.role === "USER";
  const orderQuery = useQuery({ queryKey: ["buyer-order", orderId], queryFn: () => fetchOrder(orderId) });
  const createChatMutation = useMutation({
    mutationFn: (shopId: string) => createChatRoom({ shopId, orderId }),
    onSuccess: (room) => {
      router.push(localePath(`/chat/${room.roomId}`));
    },
  });

  return (
    <>
      <BuyerTopBar title="Order detail" />
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderQuery.data ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-950">{orderQuery.data.orderNo}</h1>
                  <p className="text-sm text-slate-500">{new Date(orderQuery.data.createdAt).toLocaleString()}</p>
                </div>
                <Badge className="rounded-md bg-orange-600">{orderQuery.data.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Payment" value={orderQuery.data.paymentStatus} />
                <Info label="Total" value={formatMoney(orderQuery.data.totalCents, orderQuery.data.currency)} />
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><PackageCheckIcon className="size-5" />Items</h2>
              <div className="divide-y divide-slate-100">
                {orderQuery.data.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-950">{item.productTitle}</p>
                      <p className="text-slate-500">{item.variantTitle} · {item.shopName}</p>
                    </div>
                    <div className="text-right">
                      <p>x{item.quantity}</p>
                      <p className="font-semibold">{formatMoney(item.lineTotalCents, orderQuery.data.currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={localePath(`/orders/${orderQuery.data.id}/review`)}>Review items</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={localePath(`/orders/${orderQuery.data.id}/returns/new`)}>Return / refund</Link>
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><TruckIcon className="size-5" />Shipments</h2>
              <div className="space-y-3">
                {orderQuery.data.shipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{shipment.shopName}</p>
                        <p className="text-sm text-slate-500">{shipment.carrier ?? "Carrier pending"} {shipment.trackingNumber ?? ""}</p>
                      </div>
                      <Badge variant="outline" className="rounded-md">{shipment.status}</Badge>
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
              <Button asChild className="mt-4 bg-orange-600 hover:bg-orange-700"><Link href={localePath(`/orders/${orderQuery.data.id}/tracking`)}>Track order</Link></Button>
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
