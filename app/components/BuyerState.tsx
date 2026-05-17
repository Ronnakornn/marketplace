"use client";

import { AlertCircleIcon, PackageOpenIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { useTranslations } from "#/i18n/client";

export function BuyerLoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Skeleton className="aspect-square w-full rounded-none bg-slate-100" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BuyerLoadingList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-3 h-5 w-1/2" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function BuyerProductDetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <Skeleton className="aspect-square w-full rounded-none bg-slate-100" />
        <div className="flex gap-2 overflow-x-auto p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="size-16 shrink-0 rounded-md bg-slate-100" />
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <Skeleton className="h-8 w-5/6" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-10 w-36" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-20 rounded-md" />
            ))}
          </div>
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export function BuyerEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
        <PackageOpenIcon className="size-6" />
      </div>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function BuyerErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations();

  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
      <div className="flex gap-3">
        <AlertCircleIcon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold">{t("state.loadErrorTitle")}</h2>
          <p className="mt-1 text-sm text-red-700">{message}</p>
          {onRetry ? (
            <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCwIcon className="size-4" />
              {t("state.retry")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
