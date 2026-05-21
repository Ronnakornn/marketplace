"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HeartIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { fetchFavoriteProducts, formatMoney } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function WishlistPage() {
  const localePath = useLocalePath();
  const t = useTranslations();
  const favoritesQuery = useQuery({ queryKey: ["buyer-favorites"], queryFn: fetchFavoriteProducts });

  return (
    <>
      <BuyerTopBar title={t("buyer.wishlist")} />
      <div className="mx-auto max-w-5xl space-y-3 px-3 pb-28 pt-4">
        {favoritesQuery.isLoading ? <BuyerLoadingList /> : null}
        {favoritesQuery.isError ? <BuyerErrorState message={favoritesQuery.error.message} onRetry={() => void favoritesQuery.refetch()} /> : null}
        {favoritesQuery.isSuccess && favoritesQuery.data.length === 0 ? <BuyerEmptyState title={t("buyer.noFavoritesTitle")} description={t("buyer.noFavoritesDescription")} /> : null}
        {favoritesQuery.data?.map((favorite) => (
          <article key={favorite.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-orange-600">{favorite.shop.name}</p>
                <h2 className="mt-1 font-bold text-slate-950">{favorite.title}</h2>
                <p className="mt-2 font-bold text-orange-600">{formatMoney(favorite.price, favorite.currency)}</p>
              </div>
              <HeartIcon className="size-5 fill-orange-500 text-orange-500" />
            </div>
            <Button asChild variant="outline" className="mt-3 rounded-full">
              <Link href={localePath(`/products/${favorite.productId}`)}>{t("buyer.viewProduct")}</Link>
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
