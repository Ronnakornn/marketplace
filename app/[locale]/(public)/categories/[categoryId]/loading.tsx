"use client";

import { BuyerLoadingGrid } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Skeleton } from "#/components/ui/skeleton";
import { useTranslations } from "#/i18n/client";

export default function CategoryLoading() {
  const t = useTranslations();

  return (
    <>
      <BuyerTopBar title={t("product.category")} />
      <div className="mx-auto max-w-6xl space-y-5 px-3 pb-28 pt-4">
        <div className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-44" />
        </div>
        <BuyerLoadingGrid />
      </div>
    </>
  );
}
