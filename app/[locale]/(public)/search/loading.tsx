"use client";

import { BuyerLoadingGrid } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Skeleton } from "#/components/ui/skeleton";
import { useTranslations } from "#/i18n/client";

export default function SearchLoading() {
  const t = useTranslations();

  return (
    <>
      <BuyerTopBar title={t("common.search")} />
      <div className="mx-auto grid max-w-6xl gap-4 px-3 pb-28 pt-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </aside>
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="hidden h-10 w-72 rounded-full sm:block" />
          </div>
          <BuyerLoadingGrid />
        </section>
      </div>
    </>
  );
}
