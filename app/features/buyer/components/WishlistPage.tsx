"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, ImageIcon, StoreIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingGrid } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { fetchFavoriteProducts, formatMoney, removeFavoriteProduct, type BuyerFavoriteProduct } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

const favoriteQueryKey = ["buyer-favorites"] as const;

export function WishlistPage() {
  const queryClient = useQueryClient();
  const localePath = useLocalePath();
  const t = useTranslations();
  const favoritesQuery = useQuery({ queryKey: favoriteQueryKey, queryFn: fetchFavoriteProducts });
  const removeMutation = useMutation({
    mutationFn: removeFavoriteProduct,
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: favoriteQueryKey });
      const previousFavorites = queryClient.getQueryData<BuyerFavoriteProduct[]>(favoriteQueryKey);

      queryClient.setQueryData<BuyerFavoriteProduct[]>(favoriteQueryKey, (current) =>
        current?.filter((favorite) => favorite.productId !== productId) ?? current,
      );

      return { previousFavorites };
    },
    onSuccess: () => {
      toast.success("Removed from wishlist", {
        description: "The product was removed from your saved items.",
      });
    },
    onError: (error, _productId, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(favoriteQueryKey, context.previousFavorites);
      }

      toast.error("Could not remove item", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: favoriteQueryKey }),
  });

  const favorites = favoritesQuery.data ?? [];

  return (
    <>
      <BuyerTopBar title={t("buyer.wishlist")} />
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-28 pt-4">
        {favoritesQuery.isLoading ? <BuyerLoadingGrid /> : null}
        {favoritesQuery.isError ? <BuyerErrorState message={favoritesQuery.error.message} onRetry={() => void favoritesQuery.refetch()} /> : null}
        {favoritesQuery.isSuccess && favorites.length === 0 ? (
          <div className="space-y-3">
            <BuyerEmptyState title={t("buyer.noFavoritesTitle")} description={t("buyer.noFavoritesDescription")} />
            <div className="flex justify-center">
              <Button asChild className="h-11 rounded-2xl bg-orange-600 px-5 hover:bg-orange-700">
                <Link href={localePath("/")}>{t("buyer.shopMore")}</Link>
              </Button>
            </div>
          </div>
        ) : null}
        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map((favorite) => {
              const isRemoving = removeMutation.isPending && removeMutation.variables === favorite.productId;

              return (
                <article key={favorite.id} className="group flex min-h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <Link href={localePath(`/products/${favorite.productId}`)} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                    <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-orange-50 via-white to-slate-100 text-orange-500">
                      <ImageIcon className="size-12 opacity-70" />
                    </div>
                  </Link>
                  <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <StoreIcon className="size-3.5 shrink-0 text-orange-500" />
                        <span className="truncate">{favorite.shop.name}</span>
                      </div>
                      <Link href={localePath(`/products/${favorite.productId}`)} className="line-clamp-2 min-h-10 font-semibold leading-5 text-slate-950 hover:text-orange-600">
                        {favorite.title}
                      </Link>
                      <p className="mt-2 text-lg font-bold text-orange-600">{formatMoney(favorite.price, favorite.currency)}</p>
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                        <HeartIcon className="size-3.5 fill-orange-500 text-orange-500" />
                        {t("buyer.wishlist")}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Button asChild variant="outline" className="h-11 rounded-2xl">
                        <Link href={localePath(`/products/${favorite.productId}`)}>{t("buyer.viewProduct")}</Link>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={isRemoving}
                        aria-label={`Remove ${favorite.title} from wishlist`}
                        onClick={() => removeMutation.mutate(favorite.productId)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {removeMutation.isError && favorites.length > 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {removeMutation.error instanceof Error ? removeMutation.error.message : "Wishlist item could not be removed."}
          </div>
        ) : null}
        {favoritesQuery.isFetching && !favoritesQuery.isLoading ? (
          <div className="text-center text-sm text-slate-500">{t("common.loading")}</div>
        ) : null}
      </div>
    </>
  );
}
