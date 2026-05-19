"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import { createReturnRequest, fetchOrder } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

const reasonKeys = ["buyer.damagedItem", "buyer.wrongItem", "buyer.missingParts", "buyer.qualityIssue"] as const;
type ReturnReasonKey = (typeof reasonKeys)[number];

export function ReturnRequestPage({ orderId }: { orderId: string }) {
  const localePath = useLocalePath();
  const t = useTranslations();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [reason, setReason] = useState<ReturnReasonKey>(reasonKeys[0]);
  const [description, setDescription] = useState("");
  const [imageText, setImageText] = useState("");
  const orderQuery = useQuery({ queryKey: ["buyer-order", orderId], queryFn: () => fetchOrder(orderId) });
  const eligibleItems = useMemo(
    () => (orderQuery.data?.items ?? []).filter((item) => item.fulfillmentStatus.toLowerCase() === "delivered"),
    [orderQuery.data?.items],
  );
  const selected = selectedItemId || eligibleItems[0]?.id || "";
  const returnMutation = useMutation({
    mutationFn: () => createReturnRequest({
      orderId,
      orderItemId: selected,
      reason: t(reason),
      description,
      images: imageText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    }),
  });

  return (
    <>
      <BuyerTopBar title={t("order.returnRefund")} />
      <div className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4">
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderQuery.data && eligibleItems.length === 0 ? (
          <BuyerEmptyState title={t("buyer.noItemsEligibleForReturn")} description={t("buyer.returnEligibilityDescription")} />
        ) : null}
        {eligibleItems.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950"><RotateCcwIcon className="size-5 text-orange-600" />{t("buyer.requestReturnRefund")}</h1>
            <div className="mt-4 space-y-2">
              {eligibleItems.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 has-[:checked]:border-orange-200 has-[:checked]:bg-orange-50">
                  <input type="radio" name="returnItem" value={item.id} checked={selected === item.id} onChange={() => setSelectedItemId(item.id)} className="mt-1 accent-orange-600" />
                  <span>
                    <span className="font-semibold text-slate-950">{item.productTitle}</span>
                    <span className="block text-sm text-slate-500">{item.variantTitle} - {item.shopName}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="return-reason">{t("buyer.reason")}</Label>
              <select id="return-reason" value={reason} onChange={(event) => setReason(event.target.value as ReturnReasonKey)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm">
                {reasonKeys.map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="return-description">{t("buyer.details")}</Label>
              <Textarea id="return-description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 rounded-2xl" placeholder={t("buyer.returnEligibilityDescription")} />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="return-images">{t("buyer.evidenceImageUrls")}</Label>
              <Textarea id="return-images" value={imageText} onChange={(event) => setImageText(event.target.value)} className="min-h-20 rounded-2xl" placeholder={t("buyer.oneImageUrlPerLine")} />
            </div>
            {returnMutation.isError ? <p className="mt-3 text-sm text-red-600">{returnMutation.error.message}</p> : null}
            {returnMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-700">{t("buyer.returnSubmitted")}</p> : null}
          </section>
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button className="flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={!selected || returnMutation.isPending} onClick={() => returnMutation.mutate()}>
              {t("buyer.submitRequest")}
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
