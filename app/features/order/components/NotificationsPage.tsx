"use client";

import { useQuery } from "@tanstack/react-query";
import { BellIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { fetchNotifications } from "#/features/buyer/api";

export function NotificationsPage() {
  const notificationsQuery = useQuery({ queryKey: ["buyer-notifications"], queryFn: fetchNotifications });

  return (
    <>
      <BuyerTopBar title="Notifications" />
      <div className="mx-auto max-w-3xl space-y-3 px-3 py-4">
        {notificationsQuery.isLoading ? <BuyerLoadingList /> : null}
        {notificationsQuery.isError ? <BuyerErrorState message={notificationsQuery.error.message} onRetry={() => void notificationsQuery.refetch()} /> : null}
        {notificationsQuery.isSuccess && notificationsQuery.data.length === 0 ? <BuyerEmptyState title="ยังไม่มีการแจ้งเตือน" description="อัปเดตคำสั่งซื้อ โปรโมชัน และข้อความจากระบบจะแสดงที่นี่" /> : null}
        {notificationsQuery.data?.map((notification) => (
          <article key={notification.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><BellIcon className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-slate-950">{notification.title}</h2>
                  <Badge variant={notification.readAt ? "outline" : "default"} className="rounded-md">{notification.type}</Badge>
                </div>
                {notification.body ? <p className="mt-1 text-sm text-slate-600">{notification.body}</p> : null}
                <p className="mt-2 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
