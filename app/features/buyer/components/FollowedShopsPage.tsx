"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { StoreIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { fetchFollowedShops, formatMoney } from "#/features/buyer/api";
import { useSession } from "#/lib/auth-client";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function FollowedShopsPage() {
  const localePath = useLocalePath();
  const t = useTranslations();
  const { data: session } = useSession();
  const buyerId = session?.user.role === "USER" ? session.user.id : "";
  const shopsQuery = useInfiniteQuery({ queryKey: ["buyer-followed-shops", buyerId], initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchFollowedShops(pageParam),
    getNextPageParam: (page) => page.hasMore ? page.page + 1 : undefined,
    enabled: Boolean(buyerId),
  });
  const shops = shopsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <BuyerTopBar title={t("buyer.followedShops")} />
      <div className="mx-auto max-w-5xl space-y-3 px-3 pb-28 pt-4">
        {shopsQuery.isLoading ? <BuyerLoadingList /> : null}
        {shopsQuery.isError ? <BuyerErrorState message={shopsQuery.error.message} onRetry={() => void shopsQuery.refetch()} /> : null}
        {shopsQuery.isSuccess && shops.length === 0 ? <BuyerEmptyState title={t("buyer.noFollowedShopsTitle")} description={t("buyer.noFollowedShopsDescription")} /> : null}
        {shops.map((shop) => (
          <article key={shop.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-lg font-bold text-slate-950"><StoreIcon className="size-5 text-orange-600" />{shop.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {t("buyer.followersCount").replace("{count}", String(shop.followerCount))} - {t("buyer.productsCount").replace("{count}", String(shop.productCount))}
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-full"><Link href={localePath(`/shops/${shop.shopId}`)}>{t("buyer.viewShop")}</Link></Button>
            </div>
            {shop.products.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {shop.products.map((product) => (
                  <Link key={product.id} href={localePath(`/products/${product.id}`)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-950">{product.title}</p>
                    <p className="mt-1 text-sm font-bold text-orange-600">{formatMoney(product.price, product.currency)}</p>
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {shopsQuery.hasNextPage ? <div className="flex justify-center"><Button type="button" onClick={() => void shopsQuery.fetchNextPage()} disabled={shopsQuery.isFetchingNextPage} aria-busy={shopsQuery.isFetchingNextPage}>{t(shopsQuery.isFetchingNextPage ? "common.loading" : "common.loadMore")}</Button></div> : null}
      </div>
    </>
  );
}
