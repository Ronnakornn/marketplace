"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CheckCheckIcon, CreditCardIcon, MegaphoneIcon, MessageCircleIcon, PackageIcon, RotateCcwIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchNotifications } from "#/features/buyer/api";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { PushNotificationManager } from "./PushNotificationManager";

const tabs = [
  { value: "all", labelKey: "notification.all" },
  { value: "order", labelKey: "notification.orders" },
  { value: "payment", labelKey: "notification.payments" },
  { value: "refund", labelKey: "notification.returns" },
  { value: "chat", labelKey: "notification.chat" },
  { value: "promotion", labelKey: "notification.promos" },
] as const;

export function NotificationsPage({ showTopBar = true, scope = "all" }: { showTopBar?: boolean; scope?: "all" | "seller" }) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const formatters = useFormatters();
  const localePath = useLocalePath();
  const [tab, setTab] = useState("all");
  const notificationsQuery = useQuery({ queryKey: ["notifications", scope], queryFn: () => fetchNotifications(scope) });
  const readAllMutation = useMutation({
    mutationFn: () => fetch(`/api/notifications/read-all${scope === "seller" ? "?scope=seller" : ""}`, { method: "PATCH", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", scope] }),
  });
  const notifications = useMemo(() => {
    const items = (notificationsQuery.data ?? []).filter((notification) => notificationTypeGroup(notification.type) !== "chat");
    if (tab === "all") return items;
    return items.filter((notification) => notificationTypeGroup(notification.type) === tab);
  }, [notificationsQuery.data, tab]);

  return (
    <>
      {showTopBar ? <BuyerTopBar title={t("buyer.notifications")} /> : null}
      <div className="mx-auto max-w-3xl space-y-3 px-3 py-4">
        {scope === "all" ? <PushNotificationManager /> : null}
        <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((item) => (
              <Button key={item.value} size="sm" variant={tab === item.value ? "default" : "ghost"} className={tab === item.value ? "rounded-full bg-orange-600 hover:bg-orange-700" : "rounded-full"} onClick={() => setTab(item.value)}>
                {t(item.labelKey)}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="ml-auto rounded-full" disabled={readAllMutation.isPending} onClick={() => readAllMutation.mutate()}>
              <CheckCheckIcon className="size-4" />
              {t("notification.readAll")}
            </Button>
          </div>
        </div>
        {notificationsQuery.isLoading ? <BuyerLoadingList /> : null}
        {notificationsQuery.isError ? <BuyerErrorState message={notificationsQuery.error.message} onRetry={() => void notificationsQuery.refetch()} /> : null}
        {notificationsQuery.isSuccess && notificationsQuery.data.length === 0 ? <BuyerEmptyState title={t("notification.emptyTitle")} description={t("notification.emptyDescription")} /> : null}
        {notificationsQuery.isSuccess && notificationsQuery.data.length > 0 && notifications.length === 0 ? <BuyerEmptyState title={t("notification.emptyCategoryTitle")} description={t("notification.emptyCategoryDescription")} /> : null}
        {notifications.map((notification) => {
          const Icon = notificationIcon(notification.type);
          const targetPath = notificationTargetPath(notification);
          const card = (
            <article className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-orange-300">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><Icon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-slate-950">{formatNotificationTitle(notification, t, scope)}</h2>
                    <Badge variant={notification.readAt ? "outline" : "default"} className="rounded-md">{formatNotificationType(notification.type, t, scope)}</Badge>
                  </div>
                  {formatNotificationBody(notification, t, scope) ? <p className="mt-1 text-sm text-slate-600">{formatNotificationBody(notification, t, scope)}</p> : null}
                  <p className="mt-2 text-xs text-slate-400">{formatters.date(notification.createdAt)}</p>
                </div>
              </div>
            </article>
          );
          return targetPath
            ? <Link key={notification.id} href={localePath(targetPath)} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2">{card}</Link>
            : <div key={notification.id}>{card}</div>;
        })}
      </div>
    </>
  );
}

function notificationTargetPath(notification: { type: string; data: Record<string, unknown> | null }): string | null {
  const targetPath = notification.data?.targetPath;
  if (typeof targetPath === "string" && targetPath.startsWith("/")) return targetPath;
  const orderId = notification.data?.orderId;
  return typeof orderId === "string" ? `/orders/${encodeURIComponent(orderId)}` : null;
}

function formatNotificationType(type: string, t: (key: never) => string, scope: "all" | "seller"): string {
  const normalized = type.toLowerCase();
  if (scope === "seller" && normalized === "order_paid") return t("notification.event.sellerOrderPaid.badge" as never);
  if (scope === "seller" && normalized === "payout_paid") return t("notification.event.sellerPayoutPaid.badge" as never);
  if (scope === "seller" && normalized === "payout_rejected") return t("notification.event.sellerPayoutRejected.badge" as never);
  if (normalized === "order_paid" && scope === "all") return t("notification.event.orderPaid.badge" as never);
  return type;
}

function formatNotificationTitle(notification: { type: string; title: string }, t: (key: never) => string, scope: "all" | "seller"): string {
  if (scope === "seller" && notification.type.toLowerCase() === "order_paid") return t("notification.event.sellerOrderPaid.title" as never);
  if (scope === "seller" && notification.type.toLowerCase() === "payout_paid") return t("notification.event.sellerPayoutPaid.title" as never);
  if (scope === "seller" && notification.type.toLowerCase() === "payout_rejected") return t("notification.event.sellerPayoutRejected.title" as never);
  if (notification.type.toLowerCase() === "order_paid" && scope === "all") return t("notification.event.orderPaid.title" as never);
  return notification.title;
}

function formatNotificationBody(notification: { type: string; body: string | null; data: Record<string, unknown> | null }, t: (key: never) => string, scope: "all" | "seller"): string | null {
  if (scope === "seller" && notification.type.toLowerCase() === "order_paid") return t("notification.event.sellerOrderPaid.body" as never);
  if (scope === "seller" && notification.type.toLowerCase() === "payout_paid") return t("notification.event.sellerPayoutPaid.body" as never);
  if (scope === "seller" && notification.type.toLowerCase() === "payout_rejected") {
    const reason = notification.data?.reason;
    return typeof reason === "string" && reason
      ? t("notification.event.sellerPayoutRejected.body" as never).replace("{reason}", reason)
      : t("notification.event.sellerPayoutRejected.bodyWithoutReason" as never);
  }
  if (notification.type.toLowerCase() !== "order_paid" || scope === "seller") return notification.body;
  const orderNo = notification.data?.orderNo;
  return typeof orderNo === "string"
    ? t("notification.event.orderPaid.body" as never).replace("{orderNo}", orderNo)
    : t("notification.event.orderPaid.bodyWithoutOrder" as never);
}

function notificationTypeGroup(type: string) {
  const value = type.toLowerCase();
  if (value.includes("payment") || value.includes("payout")) return "payment";
  if (value.includes("refund") || value.includes("return")) return "refund";
  if (value.includes("chat")) return "chat";
  if (value.includes("promo") || value.includes("coupon")) return "promotion";
  return "order";
}

function notificationIcon(type: string) {
  const group = notificationTypeGroup(type);
  if (group === "payment") return CreditCardIcon;
  if (group === "refund") return RotateCcwIcon;
  if (group === "chat") return MessageCircleIcon;
  if (group === "promotion") return MegaphoneIcon;
  if (group === "order") return PackageIcon;
  return BellIcon;
}
