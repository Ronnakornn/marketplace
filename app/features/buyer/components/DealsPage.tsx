"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FlameIcon, TicketIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingGrid } from "#/components/BuyerState";
import { BuyerTopBar, MobileBottomNavigation } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { fetchCoupons, formatMoney } from "#/features/buyer/api";
import { marketplaceHomeQueryOptions, normalizeMarketplaceHome } from "#/features/marketplace/queries";
import { ProductCard } from "#/features/product/components/ProductCard";
import { formatDate, useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function DealsPage() {
  const localePath = useLocalePath();
  const locale = useLocale();
  const t = useTranslations();
  const dealsQuery = useQuery({
    ...marketplaceHomeQueryOptions({ limit: 24, locale }),
    select: normalizeMarketplaceHome,
  });
  const couponsQuery = useQuery({ queryKey: ["buyer-coupons", locale], queryFn: () => fetchCoupons(locale) });
  const flashSale = dealsQuery.data?.flashSale;
  const products = flashSale?.items ?? [];
  return (
    <>
      <BuyerTopBar title={t("common.deals")} />
      <div className="mx-auto max-w-6xl space-y-5 px-3 pb-28 pt-4">
        <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
          <div className="bg-orange-600 p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold uppercase"><FlameIcon className="size-4" />{t("buyer.flashSale")}</p>
                <h1 className="mt-1 text-2xl font-extrabold">{flashSale?.title ?? t("buyer.limitedDeals")}</h1>
                {flashSale?.endsAt ? <p className="mt-1 text-sm text-white/85">{t("buyer.endsAt").replace("{time}", formatDate(flashSale.endsAt, locale, { dateStyle: "medium", timeStyle: "short" }))}</p> : null}
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <Link key={product.id} href={localePath(`/products/${product.id}`)} className="rounded-2xl border border-orange-100 bg-orange-50 p-3 transition hover:bg-orange-100">
                <p className="line-clamp-2 min-h-10 text-sm font-bold text-slate-950">{product.title}</p>
                <p className="mt-2 text-lg font-extrabold text-orange-600">{formatMoney(product.price, product.currency)}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">{t("product.soldCount").replace("{count}", String(product.soldCount))}</p>
              </Link>
            ))}
          </div>
        </section>

        {couponsQuery.data?.length ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><TicketIcon className="size-5 text-orange-600" />{t("buyer.vouchers")}</h2>
              <Button asChild variant="ghost" size="sm"><Link href={localePath("/cart")}>{t("buyer.useInCart")}</Link></Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {couponsQuery.data.slice(0, 8).map((coupon) => (
                <div key={coupon.id} className="min-w-60 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase text-orange-600">{coupon.code}</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-950">{coupon.title || couponLabel(coupon, t)}</p>
                  {coupon.description ? <p className="mt-1 text-xs text-slate-500">{coupon.description}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {coupon.minOrderCents ? t("buyer.minSpend").replace("{amount}", formatMoney(coupon.minOrderCents)) : t("buyer.readyToApplyAtCheckout")}
                  </p>
                  {coupon.endsAt ? <p className="mt-1 text-xs font-medium text-orange-700">{t("buyer.endsAt").replace("{time}", formatDate(coupon.endsAt, locale, { dateStyle: "medium", timeStyle: "short" }))}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">{t("buyer.dealFeed")}</h2>
              <p className="text-xs text-slate-500">{t("buyer.dealFeedDescription")}</p>
            </div>
              <Button asChild variant="outline" className="rounded-full"><Link href={localePath("/search")}>{t("buyer.filterMore")}</Link></Button>
          </div>
          {dealsQuery.isLoading ? <BuyerLoadingGrid /> : null}
          {dealsQuery.isError ? <BuyerErrorState message={dealsQuery.error instanceof Error ? dealsQuery.error.message : t("state.loadErrorDescription")} onRetry={() => void dealsQuery.refetch()} /> : null}
          {dealsQuery.isSuccess && products.length === 0 ? <BuyerEmptyState title={t("buyer.noDealsAvailable")} description={t("buyer.noDealsDescription")} /> : null}
          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => <ProductCard key={product.id} product={product.buyerProduct} />)}
            </div>
          ) : null}
        </section>
      </div>
      <MobileBottomNavigation />
    </>
  );
}

function couponLabel(coupon: { discountType: string; discountPercentBps: number | null; discountValueCents: number | null }, t: ReturnType<typeof useTranslations>) {
  if (coupon.discountType.toLowerCase().includes("percent") && coupon.discountPercentBps) {
    return `${coupon.discountPercentBps / 100}% off`;
  }
  if (coupon.discountValueCents) return `${formatMoney(coupon.discountValueCents)} off`;
  if (coupon.discountType.toLowerCase().includes("shipping")) return t("product.freeShipping");
  return t("buyer.specialDeal");
}
