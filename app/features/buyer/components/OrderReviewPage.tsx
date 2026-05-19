"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StarIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import { createReview, fetchOrder } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function OrderReviewPage({ orderId }: { orderId: string }) {
  const localePath = useLocalePath();
  const t = useTranslations();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const orderQuery = useQuery({ queryKey: ["buyer-order", orderId], queryFn: () => fetchOrder(orderId) });
  const eligibleItems = useMemo(
    () => (orderQuery.data?.items ?? []).filter((item) => item.fulfillmentStatus.toLowerCase() === "delivered"),
    [orderQuery.data?.items],
  );
  const selected = selectedItemId || eligibleItems[0]?.id || "";
  const reviewMutation = useMutation({
    mutationFn: () => createReview({ orderItemId: selected, rating, comment }),
  });

  return (
    <>
      <BuyerTopBar title={t("buyer.reviewDeliveredItem")} />
      <div className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4">
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderQuery.data && eligibleItems.length === 0 ? (
          <BuyerEmptyState title={t("buyer.noItemsReadyForReview")} description={t("buyer.reviewEligibilityDescription")} />
        ) : null}
        {eligibleItems.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h1 className="text-xl font-bold text-slate-950">{t("buyer.reviewDeliveredItem")}</h1>
            <div className="mt-4 space-y-2">
              {eligibleItems.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 has-[:checked]:border-orange-200 has-[:checked]:bg-orange-50">
                  <input type="radio" name="orderItem" value={item.id} checked={selected === item.id} onChange={() => setSelectedItemId(item.id)} className="mt-1 accent-orange-600" />
                  <span>
                    <span className="font-semibold text-slate-950">{item.productTitle}</span>
                    <span className="block text-sm text-slate-500">{item.variantTitle} - {item.shopName}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <Label>{t("buyer.rating")}</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" className="rounded-full p-1 text-amber-400" onClick={() => setRating(value)} aria-label={`${value} ${t("buyer.rating")}`}>
                    <StarIcon className={`size-7 ${value <= rating ? "fill-amber-400" : ""}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="review-comment">{t("buyer.comment")}</Label>
              <Textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-28 rounded-2xl" placeholder={t("buyer.shareReviewPlaceholder")} />
            </div>
            {reviewMutation.isError ? <p className="mt-3 text-sm text-red-600">{reviewMutation.error.message}</p> : null}
            {reviewMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-700">{t("buyer.reviewSubmitted")}</p> : null}
          </section>
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button className="flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={!selected || reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
              {t("buyer.submitReview")}
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={localePath(`/orders/${orderId}`)}>{t("common.back")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
