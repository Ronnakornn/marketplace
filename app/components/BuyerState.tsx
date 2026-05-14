"use client";

import { AlertCircleIcon, PackageOpenIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";

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
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
      <div className="flex gap-3">
        <AlertCircleIcon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold">ไม่สามารถโหลดข้อมูลได้</h2>
          <p className="mt-1 text-sm text-red-700">{message}</p>
          {onRetry ? (
            <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCwIcon className="size-4" />
              ลองใหม่
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
