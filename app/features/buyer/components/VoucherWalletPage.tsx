"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TicketIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { fetchCoupons, formatMoney, type BuyerCoupon } from "#/features/buyer/api";
import { useLocale } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function VoucherWalletPage() {
  const localePath = useLocalePath();
  const locale = useLocale();
  const couponsQuery = useQuery({ queryKey: ["buyer-coupons", locale], queryFn: () => fetchCoupons(locale) });

  return (
    <>
      <BuyerTopBar title="Voucher wallet" />
      <div className="mx-auto max-w-5xl space-y-3 px-3 pb-28 pt-4">
        {couponsQuery.isLoading ? <BuyerLoadingList /> : null}
        {couponsQuery.isError ? <BuyerErrorState message={couponsQuery.error.message} onRetry={() => void couponsQuery.refetch()} /> : null}
        {couponsQuery.isSuccess && couponsQuery.data.length === 0 ? <BuyerEmptyState title="No vouchers available" description="Active marketplace and shop vouchers will appear here." /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {couponsQuery.data?.map((coupon) => (
            <article key={coupon.id} className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><TicketIcon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-orange-600">{coupon.code}</p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-950">{coupon.title || couponLabel(coupon)}</h2>
                  {coupon.description ? <p className="mt-1 text-sm text-slate-500">{coupon.description}</p> : null}
                  <p className="mt-1 text-sm text-slate-500">{coupon.minOrderCents ? `Min spend ${formatMoney(coupon.minOrderCents)}` : "Ready to apply at checkout"}</p>
                  {coupon.endsAt ? <p className="mt-1 text-xs text-slate-400">Ends {new Date(coupon.endsAt).toLocaleString()}</p> : null}
                </div>
              </div>
              <Button asChild className="mt-4 w-full rounded-2xl bg-orange-600 hover:bg-orange-700">
                <Link href={localePath(`/cart?voucher=${encodeURIComponent(coupon.code)}`)}>Use voucher</Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function couponLabel(coupon: BuyerCoupon) {
  if (coupon.discountType.toLowerCase().includes("percent") && coupon.discountPercentBps) return `${coupon.discountPercentBps / 100}% off`;
  if (coupon.discountValueCents) return `${formatMoney(coupon.discountValueCents)} off`;
  if (coupon.discountType.toLowerCase().includes("shipping")) return "Free shipping";
  return "Special voucher";
}
