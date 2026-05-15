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
import { useLocalePath } from "#/i18n/navigation";

const reasons = ["Damaged item", "Wrong item", "Missing parts", "Quality issue", "Changed my mind"];

export function ReturnRequestPage({ orderId }: { orderId: string }) {
  const localePath = useLocalePath();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [reason, setReason] = useState(reasons[0]);
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
      reason,
      description,
      images: imageText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    }),
  });

  return (
    <>
      <BuyerTopBar title="Return / refund" />
      <div className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4">
        {orderQuery.isLoading ? <BuyerLoadingList /> : null}
        {orderQuery.isError ? <BuyerErrorState message={orderQuery.error.message} onRetry={() => void orderQuery.refetch()} /> : null}
        {orderQuery.data && eligibleItems.length === 0 ? (
          <BuyerEmptyState title="No items eligible for return" description="Return requests are available after delivery." />
        ) : null}
        {eligibleItems.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950"><RotateCcwIcon className="size-5 text-orange-600" />Request return or refund</h1>
            <div className="mt-4 space-y-2">
              {eligibleItems.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 has-[:checked]:border-orange-200 has-[:checked]:bg-orange-50">
                  <input type="radio" name="returnItem" value={item.id} checked={selected === item.id} onChange={() => setSelectedItemId(item.id)} className="mt-1 accent-orange-600" />
                  <span>
                    <span className="font-semibold text-slate-950">{item.productTitle}</span>
                    <span className="block text-sm text-slate-500">{item.variantTitle} · {item.shopName}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="return-reason">Reason</Label>
              <select id="return-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm">
                {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="return-description">Details</Label>
              <Textarea id="return-description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 rounded-2xl" placeholder="Describe the issue and preferred resolution." />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="return-images">Evidence image URLs</Label>
              <Textarea id="return-images" value={imageText} onChange={(event) => setImageText(event.target.value)} className="min-h-20 rounded-2xl" placeholder="One image URL per line" />
            </div>
            {returnMutation.isError ? <p className="mt-3 text-sm text-red-600">{returnMutation.error.message}</p> : null}
            {returnMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-700">Return request submitted.</p> : null}
          </section>
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button className="flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={!selected || returnMutation.isPending} onClick={() => returnMutation.mutate()}>
              Submit request
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={localePath(`/orders/${orderId}`)}>Back</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
