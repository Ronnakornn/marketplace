"use client";

import { compareMinorUnits, type MinorUnitValue } from "#/lib/money";

import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TicketIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { claimCoupon, fetchCouponPage, type BuyerCoupon } from "#/features/buyer/api";
import { useFormatters, useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function VoucherWalletPage() {
  const localePath = useLocalePath();
  const locale = useLocale();
  const t = useTranslations();
  const formatters = useFormatters();
  const queryClient = useQueryClient();
  const queryKey = ["buyer-coupons", locale, "pages"] as const;
  const couponsQuery = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchCouponPage({ locale, page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) => lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
  });
  const coupons = couponsQuery.data?.pages.flatMap(page => page.data) ?? [];
  const claimMutation = useMutation({
    mutationFn: (couponId: string) => claimCoupon(couponId, locale),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-coupons"] }),
  });

  return (
    <>
      <BuyerTopBar title={t("buyer.voucherWallet")} />
      <div className="mx-auto max-w-5xl space-y-3 px-3 pb-28 pt-4">
        {couponsQuery.isLoading ? <BuyerLoadingList /> : null}
        {couponsQuery.isError ? <BuyerErrorState message={couponsQuery.error.message} onRetry={() => void couponsQuery.refetch()} /> : null}
        {couponsQuery.isSuccess && coupons.length === 0 ? <BuyerEmptyState title={t("buyer.noVouchersTitle")} description={t("buyer.noVouchersDescription")} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {coupons.map((coupon) => (
            <article key={coupon.id} className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><TicketIcon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-orange-600">{coupon.code}</p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-950">{coupon.title || couponLabel(coupon, t, formatters.currency)}</h2>
                  {coupon.description ? <p className="mt-1 text-sm text-slate-500">{coupon.description}</p> : null}
                  <p className="mt-1 text-sm text-slate-500">
                    {coupon.minOrderCents !== null && compareMinorUnits(coupon.minOrderCents, 0) > 0 ? t("buyer.minSpend").replace("{amount}", formatters.currency(coupon.minOrderCents)) : t("buyer.readyToApplyAtCheckout")}
                  </p>
                  {coupon.endsAt ? <p className="mt-1 text-xs text-slate-400">{t("buyer.endsAt").replace("{time}", formatters.date(coupon.endsAt))}</p> : null}
                </div>
              </div>
              {coupon.claimed ? (
                <Button asChild className="mt-4 w-full rounded-2xl bg-orange-600 hover:bg-orange-700">
                  <Link href={localePath(`/cart?voucher=${encodeURIComponent(coupon.code)}`)}>{t("buyer.useVoucher")}</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  className="mt-4 w-full rounded-2xl bg-orange-600 hover:bg-orange-700"
                  disabled={claimMutation.isPending}
                  onClick={() => claimMutation.mutate(coupon.id)}
                >
                  {t("buyer.claimVoucher")}
                </Button>
              )}
              {claimMutation.isError && claimMutation.variables === coupon.id ? (
                <p className="mt-2 text-sm text-red-600">{claimMutation.error.message}</p>
              ) : null}
            </article>
          ))}
        </div>
        {couponsQuery.hasNextPage ? <Button variant="outline" disabled={couponsQuery.isFetchingNextPage} onClick={() => void couponsQuery.fetchNextPage()}>{t("common.next")}</Button> : null}
      </div>
    </>
  );
}

function couponLabel(coupon: BuyerCoupon, t: ReturnType<typeof useTranslations>, formatCurrency: (amount: MinorUnitValue, currency?: string) => string) {
  if (coupon.discountType.toLowerCase().includes("percent") && coupon.discountPercentBps) {
    return t("buyer.percentOff").replace("{percent}", String(coupon.discountPercentBps / 100));
  }
  if (coupon.discountValueCents !== null && compareMinorUnits(coupon.discountValueCents, 0) > 0) {
    return t("buyer.amountOff").replace("{amount}", formatCurrency(coupon.discountValueCents));
  }
  if (coupon.discountType.toLowerCase().includes("shipping")) return t("product.freeShipping");
  return t("buyer.specialVoucher");
}
