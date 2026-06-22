"use client";

import { BuyerProductDetailSkeleton } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { useTranslations } from "#/i18n/client";

export default function ProductLoading() {
  const t = useTranslations();

  return (
    <>
      <BuyerTopBar title={t("product.product")} />
      <div className="mx-auto max-w-6xl px-3 pb-28 pt-4">
        <BuyerProductDetailSkeleton />
      </div>
    </>
  );
}
