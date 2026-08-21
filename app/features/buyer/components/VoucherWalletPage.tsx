"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TicketIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { claimCoupon, fetchCoupons, type BuyerCoupon } from "#/features/buyer/api";
import { useFormatters, useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function VoucherWalletPage() {
  const localePath = useLocalePath();
  const locale = useLocale();
  const t = useTranslations();
  const formatters = useFormatters();
  const queryClient = useQueryClient();
  const queryKey = ["buyer-coupons", locale] as const;
  const couponsQuery = useQuery({ queryKey, queryFn: () => fetchCoupons(locale) });
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
        {couponsQuery.isSuccess && couponsQuery.data.length === 0 ? <BuyerEmptyState title={t("buyer.noVouchersTitle")} description={t("buyer.noVouchersDescription")} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {couponsQuery.data?.map((coupon) => (
            <article key={coupon.id} className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><TicketIcon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-orange-600">{coupon.code}</p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-950">{coupon.title || couponLabel(coupon, t, formatters.currency)}</h2>
                  {coupon.description ? <p className="mt-1 text-sm text-slate-500">{coupon.description}</p> : null}
                  <p className="mt-1 text-sm text-slate-500">
                    {coupon.minOrderCents ? t("buyer.minSpend").replace("{amount}", formatters.currency(coupon.minOrderCents)) : t("buyer.readyToApplyAtCheckout")}
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
      </div>
    </>
  );
}

function couponLabel(coupon: BuyerCoupon, t: ReturnType<typeof useTranslations>, formatCurrency: (amount: number, currency?: string) => string) {
  if (coupon.discountType.toLowerCase().includes("percent") && coupon.discountPercentBps) {
    return t("buyer.percentOff").replace("{percent}", String(coupon.discountPercentBps / 100));
  }
  if (coupon.discountValueCents) {
    return t("buyer.amountOff").replace("{amount}", formatCurrency(coupon.discountValueCents));
  }
  if (coupon.discountType.toLowerCase().includes("shipping")) return t("product.freeShipping");
  return t("buyer.specialVoucher");
}
