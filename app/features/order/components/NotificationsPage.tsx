"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CheckCheckIcon, CreditCardIcon, MegaphoneIcon, MessageCircleIcon, PackageIcon, RotateCcwIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchNotifications } from "#/features/buyer/api";
import { useFormatters, useTranslations } from "#/i18n/client";

const tabs = [
  { value: "all", labelKey: "notification.all" },
  { value: "order", labelKey: "notification.orders" },
  { value: "payment", labelKey: "notification.payments" },
  { value: "refund", labelKey: "notification.returns" },
  { value: "chat", labelKey: "notification.chat" },
  { value: "promotion", labelKey: "notification.promos" },
] as const;

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const formatters = useFormatters();
  const [tab, setTab] = useState("all");
  const notificationsQuery = useQuery({ queryKey: ["buyer-notifications"], queryFn: fetchNotifications });
  const readAllMutation = useMutation({
    mutationFn: () => fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-notifications"] }),
  });
  const notifications = useMemo(() => {
    const items = (notificationsQuery.data ?? []).filter((notification) => notificationTypeGroup(notification.type) !== "chat");
    if (tab === "all") return items;
    return items.filter((notification) => notificationTypeGroup(notification.type) === tab);
  }, [notificationsQuery.data, tab]);

  return (
    <>
      <BuyerTopBar title={t("buyer.notifications")} />
      <div className="mx-auto max-w-3xl space-y-3 px-3 py-4">
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
          return (
            <article key={notification.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><Icon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-slate-950">{notification.title}</h2>
                    <Badge variant={notification.readAt ? "outline" : "default"} className="rounded-md">{notification.type}</Badge>
                  </div>
                  {notification.body ? <p className="mt-1 text-sm text-slate-600">{notification.body}</p> : null}
                  <p className="mt-2 text-xs text-slate-400">{formatters.date(notification.createdAt)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function notificationTypeGroup(type: string) {
  const value = type.toLowerCase();
  if (value.includes("payment")) return "payment";
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
