"use client";

import { BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { useTranslations } from "#/i18n/client";

export default function CartLoading() {
  const t = useTranslations();

  return (
    <>
      <BuyerTopBar title={t("cart.title")} />
      <div className="mx-auto max-w-4xl px-3 pb-28 pt-4">
        <BuyerLoadingList />
      </div>
    </>
  );
}
