"use client";

import { Badge } from "#/components/ui/badge";
import { useTranslations } from "#/i18n/client";

const tones: Record<string, string> = {
  ACTIVE: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  PAID: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  DELIVERED: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  FULFILLED: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  SUCCESS: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  SUCCEEDED: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  PENDING: "border-amber-300/30 bg-amber-300/12 text-amber-100",
  PENDING_PAYMENT: "border-amber-300/30 bg-amber-300/12 text-amber-100",
  PROCESSING: "border-sky-300/30 bg-sky-300/12 text-sky-100",
  SHIPPED: "border-sky-300/30 bg-sky-300/12 text-sky-100",
  DRAFT: "border-amber-300/30 bg-amber-300/12 text-amber-100",
  SUSPENDED: "border-red-300/30 bg-red-300/12 text-red-100",
  FAILED: "border-red-300/30 bg-red-300/12 text-red-100",
  CANCELED: "border-red-300/30 bg-red-300/12 text-red-100",
  CANCELLED: "border-red-300/30 bg-red-300/12 text-red-100",
  ARCHIVED: "border-slate-300/25 bg-white/8 text-slate-300",
  REFUNDED: "border-violet-300/30 bg-violet-300/12 text-violet-100",
};

export function AdminStatusBadge({ status }: { status?: string | null }) {
  const t = useTranslations();
  const value = status ?? "UNKNOWN";
  return (
    <Badge variant="outline" className={tones[value] ?? "border-white/20 bg-white/8 text-slate-200"}>
      {t(`admin.statuses.${value}` as Parameters<typeof t>[0]) === `admin.statuses.${value}` ? value.replaceAll("_", " ") : t(`admin.statuses.${value}` as Parameters<typeof t>[0])}
    </Badge>
  );
}
